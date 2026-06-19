import * as http from "node:http";
import * as https from "node:https";
import { OopzConfig } from "../config";
import { Signer, buildOopzApiHeaders } from "../auth";
import { DEFAULT_HEADERS } from "../config/constants";
import {
  OopzTransportError,
  OopzRateLimitError,
  OopzApiError,
} from "../exceptions";
import type { JsonObject } from "../models";

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

/** 严格布尔转换（对齐 Python coerce_bool）。 */
function coerceBool(value: unknown, defaultValue: boolean = false): boolean {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lowered = value.toLowerCase().trim();
    return lowered !== "false" && lowered !== "0" && lowered !== "";
  }
  return true;
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
   * 确保请求间至少间隔 rate_limit_interval 秒。
   */
  async throttle(): Promise<void> {
    const interval = (this.config.rateLimit?.interval ?? 0) * 1000;
    if (interval <= 0) return;

    // 串行化节流操作（对齐 Python _rate_lock）
    const prev = this.rateLock;
    let release: () => void;
    this.rateLock = new Promise<void>((resolve) => { release = resolve; });

    await prev;

    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < interval) {
      await sleep(interval - elapsed);
    }
    this.lastRequestTime = Date.now();

    release!();
  }

  /**
   * 执行 HTTP 请求，包含重试和频率限制处理。
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
    const timeoutMs = typeof timeoutVal === "number" ? timeoutVal : Array.isArray(timeoutVal) ? timeoutVal[0] * 1000 : 30_000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // 构建带签名的请求头（对齐 Python SDK: DEFAULT_HEADERS + Oopz-*）
        const bodyStr = options.body ?? "";
        let headers: Record<string, string> = {
          ...DEFAULT_HEADERS,
          ...buildOopzApiHeaders(this.config, this.signer, path, bodyStr),
        };

        if (options.headers) {
          headers = { ...headers, ...options.headers };
        }

        const parsedUrl = new globalThis.URL(url);
        const isHttps = parsedUrl.protocol === "https:";
        const agent = isHttps ? this.httpsAgent : this.httpAgent;

        // 构建代理配置（对齐 Python build_aiohttp_proxy）
        const proxyUrl = this.resolveProxy(parsedUrl);

        const response = await new Promise<HttpResponse<string>>((resolve, reject) => {
          const reqOptions: http.RequestOptions = {
            method,
            headers,
            timeout: timeoutMs,
            agent,
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
          };

          const mod = isHttps ? https : http;

          const req = mod.request(reqOptions, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => {
              const h: Record<string, string> = {};
              for (const [k, v] of Object.entries(res.headers)) {
                if (v) h[k] = Array.isArray(v) ? (v as string[]).join(", ") : v as string;
              }
              resolve({
                status: res.statusCode ?? 500,
                statusText: res.statusMessage ?? "",
                headers: h,
                data: Buffer.concat(chunks).toString("utf-8"),
              });
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

        // 检查频率限制
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers["retry-after"] || "1", 10);
          const retryMs = retryAfter * 1000;
          throw new OopzRateLimitError("Rate limited", retryMs);
        }

        return response;
      } catch (err) {
        lastError = err as Error;

        if (err instanceof OopzRateLimitError) {
          await sleep(Math.min(err.retryAfter, 30_000));
          continue;
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
        typeof msg === "string" ? msg : `HTTP ${response.status}`,
        code,
        payload,
        response
      );
    }

    let data: T;
    try {
      data = JSON.parse(response.data) as T;
    } catch (e) {
      throw new OopzApiError(
        `response is not valid JSON: ${(e as Error).message}`,
        response.status,
        undefined,
        response
      );
    }

    // 对齐 Python: 检查响应 JSON 中的 status 字段
    if (data && typeof data === "object" && "status" in data) {
      if (!coerceBool((data as any).status, false)) {
        throw new OopzApiError(
          (data as any).message ?? (data as any).msg ?? "Oopz API request failed",
          response.status,
          data,
          response
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
      jsonData
    );
  }

  /**
   * 带重试的 request_data（对齐 Python request_data_with_retry）。
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
          const waitMs = err.retryAfter > 0 ? err.retryAfter : Math.min(attempt, 3) * 1000;
          await sleep(waitMs);
          continue;
        }
        if (attempt >= maxAttempts) throw err;
      }
    }

    throw new OopzTransportError(`requestDataWithRetry failed after ${maxAttempts} attempts`);
  }

  /** 根据 URL scheme 解析代理地址（对齐 Python build_aiohttp_proxy）。 */
  private resolveProxy(parsedUrl: URL): string | undefined {
    const scheme = parsedUrl.protocol.replace(":", "").toLowerCase();
    if (scheme === "https" && this.config.proxy.https) {
      return this.config.proxy.https;
    }
    if (scheme === "http" && this.config.proxy.http) {
      return this.config.proxy.http;
    }
    return undefined;
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
