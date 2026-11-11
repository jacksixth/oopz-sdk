import { EventRegistry, EventHandler } from "./registry";
import { EventParser } from "./parser";
import { OopzConfig } from "../config";
import type { AnyEvent, EventMap } from "../models/event";
import type { JsonObject } from "../models/base";

/**
 * 事件调度器 — 将解析后的事件路由到已注册的处理器。
 */
export class EventDispatcher {
  private registry: EventRegistry;
  private parser: EventParser;
  private config: OopzConfig;

  constructor(config: OopzConfig) {
    this.config = config;
    this.registry = new EventRegistry();
    this.parser = new EventParser(config);
  }

  /**
   * 注册事件处理器。
   *
   * 事件名决定 handler 参数的类型，例如 `on("message", ...)` 的 event
   * 是 `MessageEvent`，可直接访问 `event.message`。
   */
  on<K extends keyof EventMap>(
    eventName: K,
    handler: EventHandler<EventMap[K]>
  ): void;
  on(eventName: string, handler: EventHandler<AnyEvent>): void;
  on(eventName: string, handler: EventHandler<AnyEvent>): void {
    this.registry.on(eventName, handler);
  }

  /**
   * 移除先前注册的事件处理器。
   */
  off<K extends keyof EventMap>(
    eventName: K,
    handler: EventHandler<EventMap[K]>
  ): void;
  off(eventName: string, handler: EventHandler<AnyEvent>): void;
  off(eventName: string, handler: EventHandler<AnyEvent>): void {
    this.registry.off(eventName, handler);
  }

  /** 将原始 WebSocket 有效负载通过事件管道分发。 */
  async dispatch(raw: JsonObject): Promise<void> {
    const event = this.parser.parse(raw);
    if (!event) return;

    // 忽略机器人自己发送的消息，避免自问自答死循环
    if (this.shouldIgnoreSelfMessage(event)) return;

    const handlers = this.registry.getHandlers(event.eventName);
    const wildcardHandlers = this.registry.getHandlers("*");

    const allHandlers = [...handlers, ...wildcardHandlers];

    // 无任何匹配处理器时，fallback 到 unknown（不管事件名是否以 unknown. 开头）
    if (allHandlers.length === 0) {
      const unknownHandlers = this.registry.getHandlers("unknown");
      if (unknownHandlers.length > 0) {
        for (const handler of unknownHandlers) {
          try {
            await handler(event);
          } catch (err) {
            console.error(`[oopz-sdk] Error in unknown event handler:`, err);
          }
        }
        return;
      }

      // 连 unknown 都没有 → 静默丢弃，但打印一次日志方便调试
      if (!EventDispatcher._warnedEvents.has(event.eventName)) {
        EventDispatcher._warnedEvents.add(event.eventName);
        console.debug(
          `[oopz-sdk] 未处理的事件: ${event.eventName} (eventCode=${event.eventCode}), ` +
          `raw keys: ${Object.keys(event.raw || {}).join(",")}`
        );
      }
      return;
    }

    for (const handler of allHandlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[oopz-sdk] Error in event handler for "${event.eventName}":`, err);
      }
    }
  }

  /**
   * 判断事件是否是自己发送的消息。
   * 开启 `ignoreSelfMessages`（默认）时忽略，避免 bot 处理自己的消息导致死循环。
   */
  private shouldIgnoreSelfMessage(event: AnyEvent): boolean {
    if (!this.config.ignoreSelfMessages) return false;

    const message = (event as { message?: { senderUid?: string } }).message;
    if (!message) return false;

    const senderUid = message.senderUid;
    if (!senderUid) return false;

    return senderUid === this.config.personUid;
  }

  private static _warnedEvents = new Set<string>();
}
