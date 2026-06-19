import { OopzConfig } from "../config";
import { HeartbeatConfig } from "../config/settings";
import { EVENT_AUTH, EVENT_HEARTBEAT, EVENT_SUBSCRIBE_AREA_EVENTS } from "../config/constants";
import { WebSocketTransport, WebSocketClosedError } from "../transport";
import { EventDispatcher } from "../events";
import type { EventHandler } from "../events";
import type { AnyEvent } from "../models/event";
import type { JsonObject } from "../models/base";

/** WebSocket 关闭信息（对齐 Python CloseInfo）。 */
export interface CloseInfo {
  code: number | null;
  reason: string;
  error: Error | null;
  reconnecting: boolean;
}

/** WebSocket 回调类型。 */
export type WsOnMessage = (raw: string) => Promise<void>;
export type WsOnOpen = () => Promise<void>;
export type WsOnError = (error: unknown) => Promise<void>;
export type WsOnClose = (info: CloseInfo) => Promise<void>;
export type WsOnReconnect = () => Promise<void>;

/** WebSocket 客户端选项。 */
export interface OopzWSClientOptions {
  onMessage?: WsOnMessage;
  onOpen?: WsOnOpen;
  onError?: WsOnError;
  onClose?: WsOnClose;
  onReconnect?: WsOnReconnect;
}

/**
 * Oopz 事件流的底层 WebSocket 客户端。
 * 对齐 Python SDK 的 OopzWSClient：
 * - 管理 WebSocket 连接生命周期
 * - 处理认证和心跳
 * - 自动重连
 * - 回调分发
 *
 * 对于大多数用例，请使用 OopzBot，它将此与 REST 客户端组合在一起。
 */
export class OopzWSClient {
  public config: OopzConfig;
  public transport: WebSocketTransport;
  public dispatcher: EventDispatcher;

  private onMessage: WsOnMessage | null;
  private onOpen: WsOnOpen | null;
  private onError: WsOnError | null;
  private onClose: WsOnClose | null;
  private onReconnect: WsOnReconnect | null;

  private running = false;
  private stopResolve: (() => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private hasConnectedOnce = false;

  constructor(config: OopzConfig, options: OopzWSClientOptions = {}) {
    this.config = config;
    this.transport = new WebSocketTransport(config);
    this.dispatcher = new EventDispatcher(config);

    this.onMessage = options.onMessage ?? null;
    this.onOpen = options.onOpen ?? null;
    this.onError = options.onError ?? null;
    this.onClose = options.onClose ?? null;
    this.onReconnect = options.onReconnect ?? null;
  }

  /**
   * 启动 WebSocket 客户端 — 连接、认证、启动接收/心跳循环，自动重连。
   * 对齐 Python OopzWSClient.start()。
   */
  async start(): Promise<void> {
    this.config.ensureCredentials();
    this.running = true;

    const heartbeat = this.config.heartbeat;

    while (this.running) {
      let fatalError: Error | null = null;
      let runtimeError: Error | null = null;
      let connectedThisRound = false;

      try {
        if (this.hasConnectedOnce) {
          await this.safeCallback("onReconnect", this.onReconnect);
        }

        await this.transport.connect();
        connectedThisRound = true;
        this.consecutiveFailures = 0;
        this.hasConnectedOnce = true;

        // 发送认证（对齐 Python send_auth）
        await this.sendAuth();

        await this.safeCallback("onOpen", this.onOpen);

        // 启动心跳循环
        this.startHeartbeat();

        // 进入接收循环
        await this.receiveLoop();
      } catch (err) {
        if (err instanceof WebSocketClosedError) {
          const alreadyDispatched = (err as any)._oopzErrorDispatched;
          if (!alreadyDispatched && this.onError) {
            try {
              await this.safeCallback("onError", this.onError, err);
            } catch (callbackErr: any) {
              fatalError = callbackErr;
            }
          }
          runtimeError = err;
        } else if (err instanceof Error) {
          runtimeError = err;
          console.error("[oopz-sdk:ws] WebSocket 运行异常:", err.message);

          const alreadyDispatched = (err as any)._oopzErrorDispatched;
          if (this.onError && !alreadyDispatched) {
            try {
              await this.safeCallback("onError", this.onError, err);
            } catch (callbackErr: any) {
              fatalError = callbackErr;
            }
          }
        }
      } finally {
        // 停止心跳
        this.stopHeartbeat();

        // 关闭传输
        try {
          await this.transport.close();
        } catch {
          console.error("[oopz-sdk:ws] 关闭 WebSocketTransport 失败");
        }

        // 触发 on_close 回调
        if (connectedThisRound) {
          const closeCode = runtimeError instanceof WebSocketClosedError ? runtimeError.code : null;
          const closeReason = this.getCloseReason(runtimeError);
          const closeInfo: CloseInfo = {
            code: closeCode,
            reason: closeReason,
            error: runtimeError,
            reconnecting: this.running && fatalError === null,
          };

          try {
            await this.safeCallback("onClose", this.onClose, closeInfo);
          } catch (callbackErr: any) {
            if (fatalError === null) {
              fatalError = callbackErr;
            }
          }
        }

        if (fatalError) {
          throw fatalError;
        }

        if (!this.running) break;

        // 指数退避重连（对齐 Python）
        const delay = Math.min(
          heartbeat.reconnectInterval * Math.pow(2, this.consecutiveFailures),
          heartbeat.maxReconnectInterval ?? 120
        ) * 1000;
        this.consecutiveFailures++;

        const closeReason = runtimeError instanceof WebSocketClosedError
          ? `code=${runtimeError.code} ${runtimeError.reason}`
          : "unknown";
        console.warn(
          `[oopz-sdk:ws] WebSocket 将在 ${(delay / 1000).toFixed(2)} 秒后尝试重连 (${closeReason})`
        );
        await sleep(delay);
      }
    }
  }

  /** 停止 WebSocket 客户端。 */
  async stop(): Promise<void> {
    this.running = false;
    this.stopHeartbeat();
    await this.transport.close();
  }

  /** 发送认证消息（对齐 Python send_auth）。 */
  async sendAuth(): Promise<void> {
    const authBody = {
      person: this.config.personUid,
      deviceId: this.config.deviceId,
      signature: this.config.jwtToken,
      deviceName: this.config.deviceId,
      platformName: "web",
      reconnect: 0,
    };

    const authMsg = {
      time: String(Date.now()),
      body: JSON.stringify(authBody),
      event: EVENT_AUTH,
    };

    console.log("[oopz-sdk:ws] → 发送认证 (event=253)");
    await this.transport.sendJson(authMsg);
  }

  /**
   * 订阅指定区域的事件（对齐 Python send_subscribe_area_events）。
   * 发出后，该区域的语音进出等事件才会推送过来。
   */
  async sendSubscribeAreaEvents(areas: string[]): Promise<void> {
    const cleanAreas = areas.filter((a) => String(a).trim());
    if (!cleanAreas.length) return;

    const uid = this.config.personUid;
    const msg = {
      time: String(Date.now()),
      body: JSON.stringify({
        areas: cleanAreas,
        type: 1,
        uid,
      }),
      event: EVENT_SUBSCRIBE_AREA_EVENTS,
    };

    console.log(`[oopz-sdk:ws] → 订阅区域事件: ${cleanAreas.join(", ")} (event=249)`);
    await this.transport.sendJson(msg);
  }

  /** 发送心跳（对齐 Python send_heartbeat）。 */
  async sendHeartbeat(): Promise<void> {
    if (this.transport.closed) return;

    const heartbeatMsg = {
      time: String(Date.now()),
      body: JSON.stringify({ person: this.config.personUid }),
      event: EVENT_HEARTBEAT,
    };

    try {
      await this.transport.sendJson(heartbeatMsg);
    } catch {
      // 心跳失败静默处理
    }
  }

  /** 启动心跳定时器。 */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    const interval = (this.config.heartbeat.interval ?? 10) * 1000;
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  /** 停止心跳定时器。 */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 接收循环（对齐 Python _receive_loop）。
   * 读取每条消息并通过回调/调度器分发。
   */
  private async receiveLoop(): Promise<void> {
    while (this.running && !this.transport.closed) {
      const raw = await this.transport.recv();

      // 调用外部 on_message 回调
      if (this.onMessage) {
        try {
          await this.onMessage(raw);
        } catch (err) {
          console.error("[oopz-sdk:ws] on_message 回调异常:", err);
        }
      }

      // 通过调度器分发事件
      try {
        const parsed: JsonObject = JSON.parse(raw);
        const event = parsed["event"] as number | undefined;
        const bodyRaw = parsed["body"] as string | undefined;

        // auth (253) 和 heartbeat (254) 由 SDK 内部处理，不进入 dispatcher
        if (event === EVENT_AUTH || event === EVENT_HEARTBEAT) {
          continue;
        }

        // 认证检查响应
        if (bodyRaw) {
          try {
            const inner = JSON.parse(bodyRaw);
            if (typeof inner["checkRes"] === "boolean") {
              if (inner["checkRes"]) {
                console.log("[oopz-sdk:ws] ✅ 认证通过!");
              } else {
                console.error("[oopz-sdk:ws] ❌ 认证失败! 请检查 deviceId、personUid、jwtToken 是否正确。");
              }
              continue;
            }
          } catch { /* fall through to dispatcher */ }
        }

        this.dispatcher.dispatch(parsed).catch((err) => {
          console.error("[oopz-sdk] Dispatch error:", err);
        });
      } catch {
        // 非 JSON 消息忽略
      }
    }
  }

  /** 安全调用回调（捕获异常并包装）。 */
  private async safeCallback(
    name: string,
    callback: ((...args: any[]) => Promise<void>) | null,
    ...args: any[]
  ): Promise<void> {
    if (!callback) return;
    try {
      await callback(...args);
    } catch (err: any) {
      const wrapped = new Error(`${name} failed: ${err.message}`) as any;
      wrapped.callbackName = name;
      wrapped.original = err;
      throw wrapped;
    }
  }

  /** 获取关闭原因。 */
  private getCloseReason(error: Error | null): string {
    if (!this.running) return "stopped";
    if (error instanceof WebSocketClosedError) return error.reason;
    return "connection closed";
  }

  /** 注册事件处理器。 */
  on<T extends AnyEvent = AnyEvent>(eventName: string, handler: EventHandler<T>): void {
    this.dispatcher.on(eventName, handler);
  }

  /** 移除事件处理器。 */
  off<T extends AnyEvent = AnyEvent>(eventName: string, handler: EventHandler<T>): void {
    this.dispatcher.off(eventName, handler);
  }

  /** 检查是否已连接。 */
  get isConnected(): boolean {
    return this.transport.isConnected;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
