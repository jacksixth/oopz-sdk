import { OopzConfig } from "../config";
import { EVENT_CODE_MAP, EVENT_CHAT_MESSAGE, EVENT_PRIVATE_MESSAGE, EVENT_MESSAGE_DELETE, EVENT_PRIVATE_MESSAGE_DELETE, EVENT_SERVER_ID, EVENT_MESSAGE_EDIT, EVENT_PRIVATE_MESSAGE_EDIT, EVENT_USER_ENTER_VOICE_CHANNEL, EVENT_USER_LEAVE_VOICE_CHANNEL } from "../config/constants";
import type { Message as MessageModel } from "../models/message";
import type { JsonObject } from "../models/base";
import type {
  Event,
  MessageEvent,
  MessageDeleteEvent,
  ServerIdEvent,
  VoicePresenceEvent,
  AnyEvent,
} from "../models/event";
import { parseAttachment } from "../models/attachment";

/**
 * 解析原始 WebSocket JSON 有效负载为结构化事件对象。
 *
 * Oopz 协议格式：
 *   外层: {event: number, time: string, body: string(JSON)}
 *   body 内层: 事件具体数据
 *   消息事件: body = {type: "TEXT", data: string(JSON)}，真正的消息在 data 里
 */
export class EventParser {
  private config: OopzConfig;

  constructor(config: OopzConfig) {
    this.config = config;
  }

  /** 将原始 WebSocket 有效负载解析为类型化事件。 */
  parse(raw: JsonObject): AnyEvent | null {
    // 1. 解析外层 body JSON 字符串
    let body: JsonObject = {};
    if (typeof raw["body"] === "string") {
      try {
        body = JSON.parse(raw["body"] as string) as JsonObject;
      } catch {
        console.warn("[oopz-sdk:parser] 无法解析 body JSON:", raw["body"]);
        return null;
      }
    } else if (typeof raw["body"] === "object" && raw["body"] !== null) {
      body = raw["body"] as JsonObject;
    }

    // 2. 事件码来自外层 event 字段
    const eventCode = raw["event"] as number | undefined;
    if (eventCode === undefined) {
      console.warn("[oopz-sdk:parser] 缺少 event 字段, raw keys:", Object.keys(raw).join(","));
      return null;
    }

    const eventName = EVENT_CODE_MAP[eventCode] || `unknown.${eventCode}`;
    const timestamp = (raw["time"] || body["timestamp"]) as string | undefined;

    const base: Event = {
      eventName,
      eventCode,
      raw: { ...raw, ...body },
      timestamp,
    };

    // 3. 按事件类型解析
    switch (eventCode) {
      case EVENT_CHAT_MESSAGE:
      case EVENT_PRIVATE_MESSAGE:
      case EVENT_MESSAGE_EDIT:
      case EVENT_PRIVATE_MESSAGE_EDIT:
        return this.parseMessageEvent(base, body, eventCode === EVENT_PRIVATE_MESSAGE || eventCode === EVENT_PRIVATE_MESSAGE_EDIT);

      case EVENT_MESSAGE_DELETE:
      case EVENT_PRIVATE_MESSAGE_DELETE:
        return this.parseRecallEvent(base, body);

      case EVENT_SERVER_ID:
        return this.parseServerIdEvent(base, body);

      case EVENT_USER_ENTER_VOICE_CHANNEL:
      case EVENT_USER_LEAVE_VOICE_CHANNEL:
        return this.parseVoicePresenceEvent(base, body, eventCode);

      default:
        // 未知事件：保留原始数据
        return base;
    }
  }

  /** 解析消息事件。body = {type, data: "{...}"}，data 里才是消息内容。 */
  private parseMessageEvent(base: Event, body: JsonObject, isPrivate: boolean): MessageEvent {
    // 消息数据可能在 body.data（JSON 字符串）或直接在 body 里
    let msgRaw: JsonObject = body;
    if (typeof body["data"] === "string") {
      try {
        msgRaw = JSON.parse(body["data"] as string) as JsonObject;
      } catch {
        // data 解析失败，回退使用 body
      }
    } else if (typeof body["data"] === "object" && body["data"] !== null) {
      msgRaw = body["data"] as JsonObject;
    }

    const message: MessageModel = {
      messageId: (msgRaw["messageId"] || msgRaw["id"] || "") as string,
      areaId: (msgRaw["area"] || msgRaw["areaId"]) as string | undefined,
      channelId: (msgRaw["channel"] || msgRaw["channelId"]) as string | undefined,
      senderUid: (msgRaw["person"] || msgRaw["senderUid"] || msgRaw["senderId"] || "") as string,
      senderNickname: msgRaw["senderNickname"] as string | undefined,
      senderAvatar: msgRaw["senderAvatar"] as string | undefined,
      content: (msgRaw["content"] || msgRaw["text"] || "") as string,
      timestamp: (msgRaw["timestamp"] || base.timestamp || "") as string,
      editedTimestamp: (msgRaw["editTime"] ? String(msgRaw["editTime"]) : msgRaw["editedTimestamp"]) as string | undefined,
      mentions: (msgRaw["mentionList"] || msgRaw["mentions"]) as string[] | undefined,
      mentionAll: (msgRaw["isMentionAll"] ?? msgRaw["mentionAll"]) as boolean | undefined,
      privateSessionId: msgRaw["privateSessionId"] as string | undefined,
      _raw: msgRaw,
    };

    // 附件
    if (Array.isArray(msgRaw["attachments"])) {
      message.attachments = (msgRaw["attachments"] as JsonObject[]).map(parseAttachment);
    }

    // 引用消息
    const ref = (msgRaw["referenceMessage"] || msgRaw["reference"]) as JsonObject | undefined;
    if (ref) {
      message.reference = {
        messageId: (ref["messageId"] || ref["id"] || "") as string,
        senderUid: ref["senderUid"] as string | undefined,
        senderNickname: ref["senderNickname"] as string | undefined,
        content: ref["content"] as string | undefined,
      };
    }

    const eventName = isPrivate
      ? (base.eventCode === EVENT_PRIVATE_MESSAGE_EDIT ? "message.private.edit" : "message.private")
      : (base.eventCode === EVENT_MESSAGE_EDIT ? "message.edit" : "message");

    return {
      ...base,
      eventName,
      message,
    };
  }

  /** 解析撤回事件。 */
  private parseRecallEvent(base: Event, body: JsonObject): MessageDeleteEvent {
    return {
      ...base,
      eventName: base.eventName as MessageDeleteEvent["eventName"],
      messageId: (body["messageId"] || body["id"] || "") as string,
      areaId: body["area"] as string | undefined,
      channelId: body["channel"] as string | undefined,
      senderUid: body["person"] as string | undefined,
    };
  }

  /** 解析服务端 ID 事件。 */
  private parseServerIdEvent(base: Event, body: JsonObject): ServerIdEvent {
    return {
      ...base,
      eventName: "server_id",
      serverId: (body["serverId"] || body["server_id"] || "") as string,
    };
  }

  /** 解析语音频道进出事件（对齐 Python VoiceChannelPresenceEvent）。 */
  private parseVoicePresenceEvent(
    base: Event,
    body: JsonObject,
    eventCode: number
  ): VoicePresenceEvent {
    return {
      ...base,
      eventName: (eventCode === EVENT_USER_ENTER_VOICE_CHANNEL ? "voice.enter" : "voice.leave") as VoicePresenceEvent["eventName"],
      areaId: (body["area"] || body["areaId"] || "") as string,
      channelId: (body["channel"] || body["channelId"] || "") as string,
      persons: (Array.isArray(body["persons"]) ? body["persons"] : []) as string[],
      activeNum: (body["activeNum"] || body["active_num"] || 0) as number,
    };
  }
}
