import type { AnyEvent } from "../models/event";

/** 已注册的事件处理器。 */
export type EventHandler<T extends AnyEvent = AnyEvent> = (event: T) => void | Promise<void>;

/** 从事件名称到处理器列表的映射。 */
export class EventRegistry {
  private handlers: Map<string, EventHandler[]> = new Map();

  /** 为特定事件名称注册处理器。 */
  on<T extends AnyEvent = AnyEvent>(eventName: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler as EventHandler);
  }

  /** 移除先前注册的处理器。 */
  off<T extends AnyEvent = AnyEvent>(eventName: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(eventName);
    if (list) {
      const idx = list.indexOf(handler as EventHandler);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  /** 获取某事件名称的所有处理器。 */
  getHandlers(eventName: string): EventHandler[] {
    return this.handlers.get(eventName) ?? [];
  }

  /** 检查是否已为该事件注册任何处理器。 */
  hasHandlers(eventName: string): boolean {
    return (this.handlers.get(eventName)?.length ?? 0) > 0;
  }

  /** 清除所有处理器。 */
  clear(): void {
    this.handlers.clear();
  }
}
