import * as http from "node:http";
import * as https from "node:https";
import * as zlib from "node:zlib";
import type * as stream from "node:stream";
import { OopzConfig } from "../config";
import { Signer, buildOopzApiHeaders } from "../auth";
import { DEFAULT_HEADERS } from "../config/constants";
import {
  OopzTransportError,
  OopzRateLimitError,
  OopzApiError,
  OopzAuthError,
  AUTH_FAILURE_STATUS_CODES,
} from "../exceptions";
import { coerceBool } from "../utils/payload";
import type { JsonObject } from "../models";
import { buildProxyUrl, connectThroughProxy } from "./proxy";

/** HTTP 传输层的扩展 fetch 选项。 */
export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** 是否跳过签名（例如文件上传）。 */
  skipSign?: boolean;
}

/** HTTP 响应的包装器。 */
export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

/**
 * Oopz API 通信的 HTTP 传输层。
 * 负责管理连接、签名、重试和频率限制处理。
 * 对齐 Python SDK 的 HttpTransport。
 */
export class HttpTransport {
  private config: OopzConfig;
  private signer: Signer;
  private closed: boolean;

  /** 连接池 Agent（对齐 Python aiohttp.ClientSession 的复用模式）。 */
  private httpAgent: http.Agent;
  private httpsAgent: https.Agent;

  /** 频率限制锁（对齐 Python _rate_lock）。 */
  private rateLock: Promise<void> = Promise.resolve();
  private lastRequestTime: number = 0;

  constructor(config: OopzConfig, signer: Signer) {
    this.config = config;
    this.signer = signer;
    this.closed = false;

    // 创建 keep-alive 连接池 Agent（对齐 Python aiohttp session 复用）
    this.httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10 });
    this.httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
  }

  /** 启动传输层（HTTP 为无操作，仅为接口一致性保留）。 */
  async start(): Promise<void> {
    this.closed = false;
  }

  /** 关闭传输层。 */
  async close(): Promise<void> {
    this.closed = true;
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }

  /** 检查传输层是否已关闭。 */
  get isClosed(): boolean {
    return this.closed;
  }

  /**
   * 频率限制节流（对齐 Python throttle）。
   * 确保请求间至少间隔 rate_limit.interval 秒。
   */
  async throttle(): Promise<void> {
    const interval = (this.config.rateLimit?.interval ?? 0) * 1000;
    if (interval <= 0) return;

    // 串行化节流操作（对齐 Python _rate_lock）
    const prev = this.rateLock;
    let release: () => void = () => undefined;
    this.rateLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    await prev;

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < interval) {
      await sleep(interval - elapsed);
    }
    this.lastRequestTime = Date.now();

    release();
  }

  /**
   * 执行 HTTP 请求，包含重试和频率限制处理。
   *
   * 注意：签名只对 GET 等幂等请求重试时复用同一组 header 会导致签名失效，
   * 因此每次重试都会重新签名。
   */
  async request(
    method: string,
    path: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<string>> {
    if (this.closed) {
      throw new OopzTransportError("Transport is closed");
    }

    await this.throttle();

    const url = `${this.config.baseUrl}${path}`;
    const maxAttempts = this.config.retry.maxAttempts;
    const timeoutVal = options.timeoutMs ?? this.config.request?.timeout;
    const timeoutMs = this.resolveTimeout(timeoutVal);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // 构建带签名的请求头（对齐 Python SDK: DEFAULT_HEADERS + Oopz-*）
        const bodyStr = options.body ?? "";
        let headers: Record<string, string> = {
          ...DEFAULT_HEADERS,
        };

        if (!options.skipSign) {
          headers = { ...headers, ...buildOopzApiHeaders(this.config, this.signer, path, bodyStr) };
        }

        if (options.headers) {
          headers = { ...headers, ...options.headers };
        }

        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === "https:";
        const targetPort = parsedUrl.port
          ? Number(parsedUrl.port)
          : isHttps
            ? 443
            : 80;

        // 代理配置（对齐 Python build_aiohttp_proxy）
        // 代理下统一走 CONNECT 隧道：http 目标用明文隧道，https 目标再叠一层 TLS。
        const proxyUrl = buildProxyUrl(url, this.config.proxy);

        // 代理：先建立隧道，再把 socket 交给请求
        let proxySocket: stream.Duplex | undefined;
        if (proxyUrl) {
          proxySocket = await connectThroughProxy(
            proxyUrl,
            parsedUrl.hostname,
            targetPort,
            isHttps
          );
        }

        const response = await new Promise<HttpResponse<string>>((resolve, reject) => {
          const reqOptions: http.RequestOptions = {
            method,
            headers,
            timeout: timeoutMs,
            hostname: parsedUrl.hostname,
            port: targetPort,
            path: parsedUrl.pathname + parsedUrl.search,
          };

          const mod = isHttps ? https : http;

          // 代理配置（对齐 Python build_aiohttp_proxy）：
          // 通过 CONNECT 隧道访问目标；隧道建立完成后由 createConnection 交付 socket。
          // 注意：只有在不设置 agent 时 Node 才会使用 options.createConnection，
          // 因此代理分支下不能设置 agent。
          if (proxyUrl) {
            reqOptions.createConnection = () => proxySocket!;
          } else {
            reqOptions.agent = isHttps ? this.httpsAgent : this.httpAgent;
          }

          const req = mod.request(reqOptions, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => {
              const h: Record<string, string> = {};
              for (const [k, v] of Object.entries(res.headers)) {
                if (v) h[k] = Array.isArray(v) ? (v as string[]).join(", ") : v as string;
              }

              const rawBuffer = Buffer.concat(chunks);
              const encoding = (h["content-encoding"] || "").toLowerCase();

              const finalize = (data: string) => {
                resolve({
                  status: res.statusCode ?? 500,
                  statusText: res.statusMessage ?? "",
                  headers: h,
                  data,
                });
              };

              if (encoding === "gzip" || encoding === "x-gzip") {
                zlib.gunzip(rawBuffer, (err, decoded) => {
                  if (err) {
                    finalize(rawBuffer.toString("utf-8"));
                  } else {
                    finalize(decoded.toString("utf-8"));
                  }
                });
              } else if (encoding === "deflate") {
                zlib.inflate(rawBuffer, (err, decoded) => {
                  if (err) {
                    finalize(rawBuffer.toString("utf-8"));
                  } else {
                    finalize(decoded.toString("utf-8"));
                  }
                });
              } else {
                finalize(rawBuffer.toString("utf-8"));
              }
            });
          });
          req.on("error", reject);
          req.on("timeout", () => {
            req.destroy();
            reject(new OopzTransportError("Request timeout"));
          });
          if (options.body) req.write(options.body);
          req.end();
        });

        // 429 交给上层决定是否重试：这里不吞掉错误类型
        if (response.status === 429) {
          throw new OopzRateLimitError(
            this.extractErrorMessage(response, "HTTP 429"),
            this.parseRetryAfterMs(response),
            response
          );
        }

        // 鉴权失效（401/428）单独上报，便于调用方续期凭据
        if (AUTH_FAILURE_STATUS_CODES.has(response.status)) {
          throw new OopzAuthError(
            `Oopz authentication failed (HTTP ${response.status}): ` +
              this.extractErrorMessage(response, `HTTP ${response.status}`),
            response.status,
            response
          );
        }

        return response;
      } catch (err) {
        lastError = err as Error;

        // 429 / 鉴权失败不在传输层重试：交给调用方按业务语义处理
        if (
          err instanceof OopzRateLimitError ||
          err instanceof OopzAuthError
        ) {
          throw err;
        }

        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
          await sleep(delay);
          continue;
        }
      }
    }

    throw new OopzTransportError(
      `Request failed after ${maxAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * 发起请求并将响应解析为 JSON。
   * 对齐 Python SDK 的 request_json：
   * - status !== 200 抛出错误
   * - 检查 JSON 中的 status 字段
   */
  async requestJson<T = JsonObject>(
    method: string,
    path: string,
    options: HttpRequestOptions = {}
  ): Promise<T> {
    const response = await this.request(method, path, options);

    // 对齐 Python: 仅 200 视为成功
    if (response.status !== 200) {
      let code = response.status;
      let msg = response.statusText;
      let payload: unknown = undefined;
      try {
        const parsed = JSON.parse(response.data);
        payload = parsed;
        code = (parsed as any).code ?? code;
        msg = (parsed as any).message ?? (parsed as any).msg ?? msg;
      } catch {
        // 使用默认值
      }
      throw new OopzApiError(
        typeof msg === "string" && msg ? msg : `HTTP ${response.status}`,
        code,
        response,
        payload
      );
    }

    let data: T;
    try {
      data = JSON.parse(response.data) as T;
    } catch (e) {
      throw new OopzApiError(
        `response is not valid JSON: ${(e as Error).message}`,
        response.status,
        response
      );
    }

    // 对齐 Python: 检查响应 JSON 中的 status 字段
    // status 可能是 bool、整数或字符串（包括 "false"/"0"），必须用严格布尔转换
    if (data && typeof data === "object" && "status" in data) {
      if (!coerceBool((data as any).status, false)) {
        throw new OopzApiError(
          (data as any).message ?? (data as any).msg ?? "Oopz API request failed",
          response.status,
          response,
          data
        );
      }
    }

    return data;
  }

  /**
   * 请求并提取 data 字段（对齐 Python request_data）。
   */
  async requestData<T = JsonObject>(
    method: string,
    path: string,
    options: HttpRequestOptions = {}
  ): Promise<T> {
    const jsonData = await this.requestJson<any>(method, path, options);
    if (jsonData && typeof jsonData === "object" && "data" in jsonData) {
      return jsonData["data"] as T;
    }
    throw new OopzApiError(
      "response JSON does not contain 'data' field",
      200,
      undefined,
      jsonData
    );
  }

  /**
   * 带重试的 request_data（对齐 Python request_data_with_retry）。
   *
   * 只对 429 限流做重试；其它错误直接抛出。
   */
  async requestDataWithRetry<T = JsonObject>(
    method: string,
    path: string,
    options: HttpRequestOptions & {
      maxAttempts?: number;
      retryOn429?: boolean;
    } = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts ?? this.config.retry.maxAttempts;
    const retryOn429 = options.retryOn429 ?? false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.requestData<T>(method, path, options);
      } catch (err) {
        if (err instanceof OopzRateLimitError && retryOn429 && attempt < maxAttempts) {
          const waitMs =
            err.retryAfter > 0 ? err.retryAfter : Math.min(attempt, 3) * 1000;
          await sleep(waitMs);
          continue;
        }
        throw err;
      }
    }

    // 理论不可达：循环内要么 return 要么 throw
    throw new OopzTransportError(
      `requestDataWithRetry failed after ${maxAttempts} attempts`
    );
  }

  /** 解析 Retry-After 响应头，返回毫秒数。 */  private parseRetryAfterMs(response: HttpResponse<string>): number {
    const raw = response.headers["retry-after"];
    if (!raw) return 0;
    const seconds = parseInt(raw, 10);
    if (!Number.isFinite(seconds) || seconds < 0) return 0;
    return Math.min(seconds * 1000, 30_000);
  }

  /** 从响应体中提取错误信息。 */
  private extractErrorMessage(
    response: HttpResponse<string>,
    defaultMessage: string
  ): string {
    try {
      const payload = JSON.parse(response.data);
      if (payload && typeof payload === "object") {
        const message = (payload as any).message ?? (payload as any).msg;
        const error = (payload as any).error;
        if (typeof message === "string" && message) return message;
        if (typeof error === "string" && error) return error;
      }
    } catch {
      // 非 JSON 响应，使用默认值
    }
    return defaultMessage;
  }

  /**
   * 解析超时配置。
   *
   * 支持三种形态（对齐 Python `_build_timeout`）：
   * - number：单值超时（毫秒）
   * - [connect, read]：连接超时 / 读取超时（毫秒）
   */
  private resolveTimeout(
    timeoutVal: number | [number, number] | undefined
  ): number {
    if (typeof timeoutVal === "number") return timeoutVal;
    if (Array.isArray(timeoutVal) && timeoutVal.length >= 2) {
      return timeoutVal[1];
    }
    return 30_000;
  }

  /** 便捷方法：GET 请求并解析 JSON。 */
  async get<T = JsonObject>(path: string, options?: HttpRequestOptions): Promise<T> {
    return this.requestJson<T>("GET", path, options);
  }

  /** 便捷方法：POST 请求并解析 JSON。 */
  async post<T = JsonObject>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T> {
    const opts: HttpRequestOptions = {
      ...options,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };
    return this.requestJson<T>("POST", path, opts);
  }

  /** 便捷方法：PUT 请求并解析 JSON。 */
  async put<T = JsonObject>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T> {
    const opts: HttpRequestOptions = {
      ...options,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };
    return this.requestJson<T>("PUT", path, opts);
  }

  /** 便捷方法：PATCH 请求并解析 JSON。 */
  async patch<T = JsonObject>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<T> {
    const opts: HttpRequestOptions = {
      ...options,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };
    return this.requestJson<T>("PATCH", path, opts);
  }

  /** 便捷方法：DELETE 请求并解析 JSON。 */
  async del<T = JsonObject>(path: string, options?: HttpRequestOptions): Promise<T> {
    return this.requestJson<T>("DELETE", path, options);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
