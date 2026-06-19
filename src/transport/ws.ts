import WebSocket = require("ws");
import { OopzConfig } from "../config";
import { OopzConnectionError } from "../exceptions";
import type { JsonObject } from "../models";

/**
 * WebSocket 关闭错误（对齐 Python WebSocketClosedError）。
 */
export class WebSocketClosedError extends Error {
  public code: number | null;
  public reason: string;

  constructor(code: number | null, reason: string) {
    super(reason);
    this.name = "WebSocketClosedError";
    this.code = code;
    this.reason = reason;
  }
}

/**
 * Oopz 事件流的 WebSocket 传输层。
 * 纯传输层 - 只负责原始连接/发送/接收/关闭。
 * 对齐 Python SDK 的 WebSocketTransport。
 */
export class WebSocketTransport {
  private config: OopzConfig;
  private ws: WebSocket | null = null;

  /** 持久 close 信息：在 recv() 调用间隙捕获的关闭原因。 */
  private closeInfo: { code: number; reason: string } | null = null;

  constructor(config: OopzConfig) {
    this.config = config;
  }

  /**
   * 连接到 Oopz WebSocket 网关。
   * 对齐 Python: session.ws_connect(url)
   */
  async connect(): Promise<void> {
    const url = this.config.wsUrl;

    // WebSocket 升级头：对齐 Python SDK 的浏览器模拟头
    const headers: Record<string, string> = {
      "Accept": "*/*",
      "Accept-Encoding": "gzip, deflate",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "Cache-Control": "no-cache",
      "Origin": "https://web.oopz.cn",
      "Pragma": "no-cache",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/140.0.0.0 Safari/537.36",
      "x-oopz-device-id": this.config.deviceId,
      "x-oopz-person-uid": this.config.personUid,
      "x-oopz-app-version": this.config.appVersion,
      "x-oopz-platform": this.config.platform,
    };

    console.log("[oopz-sdk:ws] 正在连接:", url);

    this.ws = new WebSocket(url, { headers });
    this.closeInfo = null;

    // 持久 close 监听：确保 recv() 间隙的关闭也能捕获
    this.ws.on("close", (code: number, reason: Buffer) => {
      const reasonStr = reason.toString("utf-8") || "(无)";
      console.log(`[oopz-sdk:ws] ❌ WebSocket 关闭: code=${code}, reason=${reasonStr}`);
      this.closeInfo = { code, reason: reasonStr };
    });

    return new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new OopzConnectionError("WebSocket creation failed"));

      const timeoutVal = this.config.request?.timeout;
      const timeoutMs = Array.isArray(timeoutVal) ? timeoutVal[0] * 1000 : (typeof timeoutVal === "number" ? timeoutVal : 10_000);
      const timeout = setTimeout(() => {
        reject(new OopzConnectionError("WebSocket connection timeout"));
      }, timeoutMs);

      this.ws.on("open", () => {
        clearTimeout(timeout);
        console.log("[oopz-sdk:ws] ✅ WebSocket 已连接:", url);
        resolve();
      });

      this.ws.on("error", (err: Error) => {
        clearTimeout(timeout);
        console.error(`[oopz-sdk:ws] ⚠️ WebSocket 错误:`, err.message);
        reject(new OopzConnectionError(`WebSocket error: ${err.message}`));
      });
    });
  }

  /**
   * 接收一条消息（对齐 Python recv）。
   * 返回原始字符串，由上层解析。
   */
  async recv(): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const info = this.closeInfo;
      throw new WebSocketClosedError(
        info?.code ?? null,
        info?.reason || "WebSocket is not connected"
      );
    }

    return new Promise<string>((resolve, reject) => {
      const onMessage = (data: WebSocket.Data) => {
        cleanup();
        const text = typeof data === "string" ? data : data.toString("utf-8");
        resolve(text);
      };

      const onClose = (code: number, reason: Buffer) => {
        cleanup();
        reject(new WebSocketClosedError(code, reason.toString("utf-8") || "connection closed"));
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const cleanup = () => {
        this.ws?.removeListener("message", onMessage);
        this.ws?.removeListener("close", onClose);
        this.ws?.removeListener("error", onError);
      };

      this.ws!.once("message", onMessage);
      this.ws!.once("close", onClose);
      this.ws!.once("error", onError);
    });
  }

  /**
   * 通过 WebSocket 发送 JSON 消息（对齐 Python send_json）。
   */
  async sendJson(data: JsonObject): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketClosedError(null, "WebSocket is not connected");
    }
    this.ws.send(JSON.stringify(data));
  }

  /**
   * 关闭 WebSocket 连接（对齐 Python close）。
   */
  async close(): Promise<void> {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close(1000, "Client closing");
    }
    this.ws = null;
    this.closeInfo = null;
  }

  /** 检查连接是否已关闭。 */
  get closed(): boolean {
    return !this.ws || this.ws.readyState === WebSocket.CLOSED;
  }

  /** 检查是否已连接。 */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
