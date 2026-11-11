import { OopzConfig } from "../config";
import {
  EVENT_CODE_MAP,
  EVENT_CHAT_MESSAGE,
  EVENT_PRIVATE_MESSAGE,
  EVENT_MESSAGE_DELETE,
  EVENT_PRIVATE_MESSAGE_DELETE,
  EVENT_SERVER_ID,
  EVENT_MESSAGE_EDIT,
  EVENT_PRIVATE_MESSAGE_EDIT,
  EVENT_USER_ENTER_VOICE_CHANNEL,
  EVENT_USER_LEAVE_VOICE_CHANNEL,
  EVENT_AUTH,
  EVENT_HEARTBEAT,
  EVENT_AUTH_RESULT,
  EVENT_FRIEND_REQUEST,
  EVENT_FRIEND_DELETE,
  EVENT_MESSAGE_REACTION,
  EVENT_CHANNEL_UPDATE,
  EVENT_PUBLIC_CHANNEL_CREATE,
  EVENT_CHANNEL_DELETE,
  EVENT_CHANNEL_VOICE_BAN,
  EVENT_CHANNEL_MESSAGE_BAN,
  EVENT_USER_UPDATE,
  EVENT_USER_LOGIN_STATE_CHANGED,
  EVENT_AREA_UPDATE,
  EVENT_ROLE_CHANGED,
} from "../config/constants";
import type { Message as MessageModel } from "../models/message";
import type { JsonObject } from "../models/base";
import type {
  Event,
  MessageEvent,
  MessageDeleteEvent,
  ServerIdEvent,
  HeartbeatEvent,
  AuthEvent,
  FriendRequestEvent,
  FriendDeleteEvent,
  MessageReactionEvent,
  AreaDisableEvent,
  ChannelUpdateEvent,
  ChannelCreateEvent,
  ChannelDeleteEvent,
  VoicePresenceEvent,
  UserUpdateEvent,
  UserLoginStateEvent,
  AreaUpdateEvent,
  RoleChangedEvent,
  AnyEvent,
} from "../models/event";
import { parseAttachment } from "../models/attachment";
import { coerceBool } from "../utils/payload";

/** 解析原始 WebSocket JSON 有效负载为结构化事件对象。 */
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

      case EVENT_HEARTBEAT:
        return this.parseHeartbeatEvent(base);

      case EVENT_AUTH:
      case EVENT_AUTH_RESULT:
        return this.parseAuthEvent(base, body);

      case EVENT_FRIEND_REQUEST:
        return this.parseFriendRequestEvent(base, body);

      case EVENT_FRIEND_DELETE:
        return this.parseFriendDeleteEvent(base, body);

      case EVENT_MESSAGE_REACTION:
        return this.parseMessageReactionEvent(base, body);

      case EVENT_CHANNEL_VOICE_BAN:
      case EVENT_CHANNEL_MESSAGE_BAN:
        return this.parseAreaDisableEvent(base, body);

      case EVENT_CHANNEL_UPDATE:
        return this.parseChannelUpdateEvent(base, body);

      case EVENT_PUBLIC_CHANNEL_CREATE:
        return this.parseChannelCreateEvent(base, body);

      case EVENT_CHANNEL_DELETE:
        return this.parseChannelDeleteEvent(base, body);

      case EVENT_USER_ENTER_VOICE_CHANNEL:
      case EVENT_USER_LEAVE_VOICE_CHANNEL:
        return this.parseVoicePresenceEvent(base, body, eventCode);

      case EVENT_USER_UPDATE:
        return this.parseUserUpdateEvent(base, body);

      case EVENT_USER_LOGIN_STATE_CHANGED:
        return this.parseUserLoginStateEvent(base, body);

      case EVENT_AREA_UPDATE:
        return this.parseAreaUpdateEvent(base, body);

      case EVENT_ROLE_CHANGED:
        return this.parseRoleChangedEvent(base, body);

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
      messageId: str(msgRaw["messageId"] ?? msgRaw["id"]),
      areaId: str(msgRaw["area"] ?? msgRaw["areaId"]) || undefined,
      channelId: str(msgRaw["channel"] ?? msgRaw["channelId"]) || undefined,
      senderUid: str(msgRaw["person"] ?? msgRaw["senderUid"] ?? msgRaw["senderId"]),
      senderNickname: str(msgRaw["senderNickname"]) || undefined,
      senderAvatar: str(msgRaw["senderAvatar"]) || undefined,
      content: str(msgRaw["content"] ?? msgRaw["text"]),
      timestamp: str(msgRaw["timestamp"] ?? base.timestamp),
      editedTimestamp: str(msgRaw["editTime"] ?? msgRaw["editedTimestamp"]) || undefined,
      mentions: Array.isArray(msgRaw["mentionList"])
        ? (msgRaw["mentionList"] as string[])
        : undefined,
      mentionAll: coerceBool(msgRaw["isMentionAll"] ?? msgRaw["mentionAll"], false),
      privateSessionId: str(msgRaw["privateSessionId"]) || undefined,
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
        messageId: str(ref["messageId"] ?? ref["id"]),
        senderUid: str(ref["senderUid"]) || undefined,
        senderNickname: str(ref["senderNickname"]) || undefined,
        content: str(ref["content"]) || undefined,
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
    const mentionList = Array.isArray(body["mentionList"]) ? body["mentionList"] : undefined;
    return {
      ...base,
      eventName: base.eventName as MessageDeleteEvent["eventName"],
      messageId: str(body["messageId"] ?? body["id"]),
      areaId: str(body["area"]) || undefined,
      channelId: str(body["channel"]) || undefined,
      senderUid: str(body["person"]) || undefined,
      isMentionAll: coerceBool(body["isMentionAll"], false),
      mentionList,
    };
  }

  /** 解析服务端 ID 事件。 */
  private parseServerIdEvent(base: Event, body: JsonObject): ServerIdEvent {
    return {
      ...base,
      eventName: "server_id",
      serverId: str(body["serverId"] ?? body["server_id"]),
    };
  }

  /** 解析心跳事件。 */
  private parseHeartbeatEvent(base: Event): HeartbeatEvent {
    return {
      ...base,
      eventName: "heartbeat",
    };
  }

  /** 解析鉴权结果事件。 */
  private parseAuthEvent(base: Event, body: JsonObject): AuthEvent {
    return {
      ...base,
      eventName: "auth",
      code: num(body["code"]),
      message: str(body["message"]) || undefined,
    };
  }

  /** 解析好友请求事件。 */
  private parseFriendRequestEvent(base: Event, body: JsonObject): FriendRequestEvent {
    return {
      ...base,
      eventName: "friend.request",
      person: str(body["person"]),
      name: str(body["name"]) || undefined,
      avatar: str(body["avatar"]) || undefined,
      friendRequestId: num(body["friendRequestId"]),
      createTime: str(body["createTime"]) || undefined,
    };
  }

  /** 解析好友删除事件。 */
  private parseFriendDeleteEvent(base: Event, body: JsonObject): FriendDeleteEvent {
    return {
      ...base,
      eventName: "friend.delete",
      person: str(body["person"]),
    };
  }

  /** 解析消息表情事件。 */
  private parseMessageReactionEvent(base: Event, body: JsonObject): MessageReactionEvent {
    return {
      ...base,
      eventName: "message.reaction",
      messageId: str(body["messageId"]),
      areaId: str(body["area"]) || undefined,
      areaPage: str(body["areaPage"]) || undefined,
      channelId: str(body["channel"]) || undefined,
      person: str(body["person"]) || undefined,
      emoji: str(body["emoji"]) || undefined,
      type: str(body["type"]) || undefined,
    };
  }

  /** 解析域内禁言/禁麦事件。 */
  private parseAreaDisableEvent(base: Event, body: JsonObject): AreaDisableEvent {
    return {
      ...base,
      eventName: base.eventName as AreaDisableEvent["eventName"],
      ackId: str(body["ackId"]) || undefined,
      type: str(body["type"]) || undefined,
      areaId: str(body["area"]) || undefined,
      disableTo: str(body["disableTo"]) || undefined,
    };
  }

  /** 解析频道设置变更事件。 */
  private parseChannelUpdateEvent(base: Event, body: JsonObject): ChannelUpdateEvent {
    const accessibleRoles = Array.isArray(body["accessibleRoles"])
      ? body["accessibleRoles"]
      : Array.isArray(body["accessible"])
        ? body["accessible"]
        : [];
    return {
      ...base,
      eventName: "channel.update",
      areaId: str(body["area"]) || undefined,
      channelId: str(body["channel"]) || undefined,
      name: str(body["name"]) || undefined,
      channelType: str(body["type"]) || undefined,
      secret: coerceBool(body["secret"], false),
      memberPublic: coerceBool(body["memberPublic"], false),
      maxMember: num(body["maxMember"], 30000),
      textGapSecond: num(body["textGapSecond"], 0),
      voiceControlEnabled: coerceBool(body["voiceControlEnabled"], false),
      textControlEnabled: coerceBool(body["textControlEnabled"], false),
      accessControlEnabled: coerceBool(body["accessControlEnabled"], false),
      hasPassword: coerceBool(body["hasPassword"], false),
      voiceRoles: Array.isArray(body["voiceRoles"]) ? body["voiceRoles"] : [],
      textRoles: Array.isArray(body["textRoles"]) ? body["textRoles"] : [],
      accessibleRoles,
      disableVoice: Array.isArray(body["disableVoice"]) ? body["disableVoice"] : [],
      disableText: Array.isArray(body["disableText"]) ? body["disableText"] : [],
    };
  }

  /** 解析频道创建事件。 */
  private parseChannelCreateEvent(base: Event, body: JsonObject): ChannelCreateEvent {
    const channelType = str(body["channelType"]) || str(body["type"]) || undefined;
    const accessibleRoles = Array.isArray(body["accessibleRoles"])
      ? body["accessibleRoles"]
      : Array.isArray(body["accessible"])
        ? body["accessible"]
        : [];
    return {
      ...base,
      eventName: "channel.create",
      areaId: str(body["area"]) || undefined,
      channelId: str(body["channel"]) || undefined,
      name: str(body["name"]) || undefined,
      channelType,
      groupId: str(body["groupId"]) || undefined,
      secret: coerceBool(body["secret"], false),
      memberPublic: coerceBool(body["memberPublic"], false),
      maxMember: num(body["maxMember"], 0),
      isTemp: coerceBool(body["isTemp"], false),
      hasPassword: coerceBool(body["hasPassword"], false),
      voiceRoles: Array.isArray(body["voiceRoles"]) ? body["voiceRoles"] : [],
      textRoles: Array.isArray(body["textRoles"]) ? body["textRoles"] : [],
      accessibleRoles,
      accessibleMembers: Array.isArray(body["accessibleMembers"])
        ? (body["accessibleMembers"] as string[])
        : [],
    };
  }

  /** 解析频道删除事件。 */
  private parseChannelDeleteEvent(base: Event, body: JsonObject): ChannelDeleteEvent {
    return {
      ...base,
      eventName: "channel.delete",
      areaId: str(body["area"]) || undefined,
      channelId: str(body["channel"]) || undefined,
      ackId: str(body["ackId"]) || undefined,
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
      areaId: str(body["area"] ?? body["areaId"]),
      channelId: str(body["channel"] ?? body["channelId"]),
      persons: Array.isArray(body["persons"]) ? (body["persons"] as string[]) : [],
      activeNum: num(body["activeNum"] ?? body["active_num"], 0),
      fromChannel: str(body["fromChannel"]) || undefined,
      fromArea: str(body["fromArea"]) || undefined,
      sort: num(body["sort"], 0),
      sound: str(body["sound"]) || undefined,
    };
  }

  /** 解析用户资料变更事件。 */
  private parseUserUpdateEvent(base: Event, body: JsonObject): UserUpdateEvent {
    const updates = body["updates"];
    return {
      ...base,
      eventName: "user.update",
      person: str(body["person"]),
      updates: typeof updates === "object" && updates !== null ? (updates as JsonObject) : {},
    };
  }

  /** 解析用户登录状态事件。 */
  private parseUserLoginStateEvent(base: Event, body: JsonObject): UserLoginStateEvent {
    return {
      ...base,
      eventName: "user.login_state",
      person: str(body["person"]),
      type: str(body["type"]) || undefined,
    };
  }

  /** 解析域信息变更事件。 */
  private parseAreaUpdateEvent(base: Event, body: JsonObject): AreaUpdateEvent {
    return {
      ...base,
      eventName: "area.update",
      areaId: str(body["area"]) || undefined,
      code: str(body["code"]) || undefined,
      name: str(body["name"]) || undefined,
      avatar: str(body["avatar"]) || undefined,
      owner: str(body["owner"]) || undefined,
      description: str(body["desc"]) || undefined,
    };
  }

  /** 解析身份组变更事件。 */
  private parseRoleChangedEvent(base: Event, body: JsonObject): RoleChangedEvent {
    return {
      ...base,
      eventName: "role.change",
      areaId: str(body["area"]) || undefined,
      roleId: num(body["roleID"] ?? body["roleId"], 0),
      type: str(body["type"]) || undefined,
      name: str(body["name"]) || undefined,
      description: str(body["description"]) || undefined,
      ackId: str(body["ackId"]) || undefined,
      isDisplay: coerceBool(body["isDisplay"], false),
      sort: num(body["sort"], 0),
      roleType: num(body["roleType"], 0),
      privilegeKeys: Array.isArray(body["privilegeKeys"]) ? body["privilegeKeys"] : [],
      categoryKeys: Array.isArray(body["categoryKeys"]) ? body["categoryKeys"] : [],
    };
  }
}

/** 安全转字符串（null/undefined → ""）。 */
function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

/** 安全转数字（非数字 → defaultValue）。 */
function num(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === "") return defaultValue;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}
