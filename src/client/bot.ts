import { OopzConfig } from "../config";
import { OopzRESTClient } from "./rest";
import { OopzWSClient } from "./ws";
import { sdkLog } from "../logger";
import { Voice } from "../services/voice";
import type { EventHandler } from "../events";
import type { AnyEvent, EventMap } from "../models/event";
import type { Message as MessageService } from "../services/message";
import type { Media } from "../services/media";
import type { AreaService } from "../services/area";
import type { Channel } from "../services/channel";
import type { Person } from "../services/person";
import type { Moderation } from "../services/moderation";
import type { JsonObject } from "../models";

/**
 * 高级 bot 入口点 — 将 REST 客户端、WebSocket 客户端、
 * 事件分发和所有服务组合成一个易于使用的接口。
 *
 * 这是大多数 bot 开发的推荐起点。
 *
 * @example
 * ```ts
 * import { OopzBot, OopzConfig } from "oopz-sdk";
 *
 * const config = OopzConfig.fromEnv();
 * const bot = new OopzBot(config);
 *
 * bot.on("message", async (event) => {
 *   console.log(`[${event.message.senderNickname}]: ${event.message.content}`);
 * });
 *
 * await bot.start();
 * ```
 */
export class OopzBot {
  public config: OopzConfig;
  public rest: OopzRESTClient;
  public ws: OopzWSClient;

  // 服务快捷方式（由 REST 客户端委派）
  public messages: MessageService;
  public media: Media;
  public areas: AreaService;
  public channels: Channel;
  public person: Person;
  /** person 服务的别名。 */
  public members: Person;
  public moderation: Moderation;
  /** 语音频道服务。 */
  public voice: Voice;

  private _started = false;

  constructor(config: OopzConfig) {
    this.config = config;
    this.rest = new OopzRESTClient(config, this);

    // 传入 onOpen 回调：连接成功后自动订阅已加入区域的事件
    this.ws = new OopzWSClient(config, {
      onOpen: () => this.subscribeJoinedAreas(),
    });

    // Service shortcuts
    this.messages = this.rest.messages;
    this.media = this.rest.media;
    this.areas = this.rest.areas;
    this.channels = this.rest.channels;
    this.person = this.rest.person;
    this.members = this.rest.members;
    this.moderation = this.rest.moderation;
    this.voice = new Voice(
      this,
      config,
      this.rest.transport,
      this.rest.signer,
      this.rest.cache
    );
  }

  /**
   * 启动 bot — 同时连接 REST 传输层和 WebSocket。
   */
  async start(): Promise<void> {
    if (this._started) return;

    this.config.ensureCredentials();

    await this.rest.start();

    // 使用新的 start() 方法（包含认证、心跳、重连）
    // 在后台启动 WS，不阻塞
    this.ws.start().catch((err) => {
      console.error("[oopz-sdk:bot] WS start error:", err);
    });

    this._started = true;
  }

  /**
   * 停止 bot — 断开 WebSocket 并关闭 REST 传输层。
   */
  async close(): Promise<void> {
    if (!this._started) return;

    await this.ws.stop();
    await this.voice.close();
    await this.rest.close();

    this._started = false;
  }

  /**
   * 自动订阅已加入区域的事件（对齐 Python _subscribe_joined_area_events_on_startup）。
   * 在 WebSocket 连接成功后由 onOpen 回调自动触发。
   */
  private async subscribeJoinedAreas(): Promise<void> {
    if (!this.config.autoSubscribeJoinedAreas) return;

    try {
      const joined = await this.areas.getJoinedAreas();
      const areaIds = joined.map((a) => a.areaId).filter(Boolean);
      if (areaIds.length === 0) return;

      await this.ws.sendSubscribeAreaEvents(areaIds);
      sdkLog(`[oopz-sdk:bot] 已订阅 ${areaIds.length} 个区域的事件`);
    } catch (err) {
      console.error("[oopz-sdk:bot] 订阅区域事件失败:", (err as Error).message);
    }
  }

  /**
   * 注册事件处理器。
   *
   * 事件名会决定 handler 的参数类型，例如 `bot.on("message", ...)` 的
   * `event` 是 `MessageEvent`，可直接访问 `event.message`。
   *
   * 支持的事件名：
   * - `"message"` / `"message.private"` / `"message.edit"` / `"message.private.edit"` — 消息
   * - `"recall"` / `"recall.private"` — 撤回
   * - `"voice.enter"` / `"voice.leave"` — 语音频道进出
   * - `"channel.update"` / `"channel.create"` / `"channel.delete"` — 频道变化
   * - `"user.update"` / `"user.login_state"` — 用户变化
   * - `"area.update"` — 域信息变化
   * - `"role.change"` — 身份组变化
   * - `"friend.request"` / `"friend.delete"` — 好友事件
   * - `"message.reaction"` — 消息表情
   * - `"moderation.text_ban"` / `"moderation.voice_ban"` — 管理事件
   * - `"server_id"` / `"auth"` / `"heartbeat"` — 系统事件
   * - `"*"` — 通配符，匹配所有事件
   * - `"unknown"` — 未映射事件码的兜底
   */
  on<K extends keyof EventMap>(
    eventName: K,
    handler: EventHandler<EventMap[K]>
  ): void;
  on(eventName: string, handler: EventHandler<AnyEvent>): void;
  on(eventName: string, handler: EventHandler<AnyEvent>): void {
    this.ws.on(eventName, handler);
  }

  /** 移除先前注册的事件处理器。 */
  off<K extends keyof EventMap>(
    eventName: K,
    handler: EventHandler<EventMap[K]>
  ): void;
  off(eventName: string, handler: EventHandler<AnyEvent>): void;
  off(eventName: string, handler: EventHandler<AnyEvent>): void {
    this.ws.off(eventName, handler);
  }

  /** 便捷方法：向频道发送文本消息。 */
  async send(
    area: string,
    channel: string,
    content: string,
    options?: { referenceMessageId?: string }
  ) {
    return this.messages.sendMessage(area, channel, content, options);
  }

  /** 便捷方法：回复消息。 */
  async reply(
    area: string,
    channel: string,
    messageId: string,
    content: string
  ) {
    return this.messages.reply(area, channel, messageId, content);
  }

  /** 便捷方法：撤回消息。 */
  async recall(area: string, channel: string, messageId: string) {
    return this.messages.recall(area, channel, messageId);
  }

  /** bot 是否已经启动。 */
  get started(): boolean {
    return this._started;
  }
}
