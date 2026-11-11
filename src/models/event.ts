import type { JsonObject } from "./base";
import type { Message } from "./message";

// ── 基础事件 ──────────────────────────────────────────

/** 所有 Oopz 事件的基类。 */
export interface Event {
  /** SDK 事件名（如 "message"、"recall"、"voice.enter"）。 */
  eventName: string;
  /** 原始 Oopz 事件码。 */
  eventCode: number;
  /** 接收到的原始数据（外层信封与 body 合并）。 */
  raw: JsonObject;
  /** 服务端时间戳。 */
  timestamp?: string;
}

// ── 消息事件 ───────────────────────────────────────

export interface MessageEvent extends Event {
  eventName: "message" | "message.private" | "message.edit" | "message.private.edit";
  message: Message;
}

export interface MessageDeleteEvent extends Event {
  eventName: "recall" | "recall.private";
  messageId: string;
  areaId?: string;
  channelId?: string;
  senderUid?: string;
  isMentionAll?: boolean;
  mentionList?: unknown[];
}

// ── 服务端 ID / 心跳 / 鉴权 ─────────────────────────────

export interface ServerIdEvent extends Event {
  eventName: "server_id";
  serverId: string;
}

export interface HeartbeatEvent extends Event {
  eventName: "heartbeat";
}

export interface AuthEvent extends Event {
  eventName: "auth";
  code?: number;
  message?: string;
}

// ── 好友事件 ───────────────────────────────────────

export interface FriendRequestEvent extends Event {
  eventName: "friend.request";
  person: string;
  name?: string;
  avatar?: string;
  friendRequestId?: number;
  createTime?: string;
}

export interface FriendDeleteEvent extends Event {
  eventName: "friend.delete";
  person: string;
}

// ── 表情事件 ───────────────────────────────────────

export interface MessageReactionEvent extends Event {
  eventName: "message.reaction";
  messageId: string;
  areaId?: string;
  areaPage?: string;
  channelId?: string;
  person?: string;
  emoji?: string;
  type?: string;
}

// ── 管理事件 ───────────────────────────────────────

export interface AreaDisableEvent extends Event {
  eventName: "moderation.voice_ban" | "moderation.text_ban";
  ackId?: string;
  type?: string;
  areaId?: string;
  disableTo?: string;
}

// ── 频道事件 ───────────────────────────────────────

export interface ChannelUpdateEvent extends Event {
  eventName: "channel.update";
  areaId?: string;
  channelId?: string;
  name?: string;
  channelType?: string;
  secret?: boolean;
  memberPublic?: boolean;
  maxMember?: number;
  textGapSecond?: number;
  voiceControlEnabled?: boolean;
  textControlEnabled?: boolean;
  accessControlEnabled?: boolean;
  hasPassword?: boolean;
  voiceRoles?: unknown[];
  textRoles?: unknown[];
  accessibleRoles?: unknown[];
  disableVoice?: unknown[];
  disableText?: unknown[];
}

export interface ChannelCreateEvent extends Event {
  eventName: "channel.create";
  areaId?: string;
  channelId?: string;
  name?: string;
  channelType?: string;
  groupId?: string;
  secret?: boolean;
  memberPublic?: boolean;
  maxMember?: number;
  isTemp?: boolean;
  hasPassword?: boolean;
  voiceRoles?: unknown[];
  textRoles?: unknown[];
  accessibleRoles?: unknown[];
  accessibleMembers?: string[];
}

export interface ChannelDeleteEvent extends Event {
  eventName: "channel.delete";
  areaId?: string;
  channelId?: string;
  ackId?: string;
}

// ── 语音事件 ───────────────────────────────────────

/** 语音频道进出事件（对齐 Python VoiceChannelPresenceEvent）。 */
export interface VoicePresenceEvent extends Event {
  eventName: "voice.enter" | "voice.leave";
  /** 区域 ID。 */
  areaId: string;
  /** 频道 ID。 */
  channelId: string;
  /** 进出用户 UID 列表。 */
  persons: string[];
  /** 频道内当前活跃人数。 */
  activeNum: number;
  /** 来源频道（跨频道移动时）。 */
  fromChannel?: string;
  /** 来源区域（跨区域移动时）。 */
  fromArea?: string;
  /** 排序值。 */
  sort?: number;
  /** 音效标记。 */
  sound?: string;
}

// ── 用户 / 域 / 身份组事件 ─────────────────────────────

export interface UserUpdateEvent extends Event {
  eventName: "user.update";
  person: string;
  updates?: JsonObject;
}

export interface UserLoginStateEvent extends Event {
  eventName: "user.login_state";
  person: string;
  type?: string;
}

export interface AreaUpdateEvent extends Event {
  eventName: "area.update";
  areaId?: string;
  code?: string;
  name?: string;
  avatar?: string;
  owner?: string;
  description?: string;
}

export interface RoleChangedEvent extends Event {
  eventName: "role.change";
  areaId?: string;
  roleId?: number;
  type?: string;
  name?: string;
  description?: string;
  ackId?: string;
  isDisplay?: boolean;
  sort?: number;
  roleType?: number;
  privilegeKeys?: unknown[];
  categoryKeys?: unknown[];
}

// ── 兼容别名（协议未推送这些事件，保留仅为向后兼容） ──────────

/** @deprecated 协议中没有「加入频道」事件码，该类型不会被派发。 */
export type ChannelJoinEvent = Event;
/** @deprecated 协议中没有「离开频道」事件码，该类型不会被派发。 */
export type ChannelLeaveEvent = Event;
/** @deprecated 协议中没有「成员加入域」事件码，该类型不会被派发。 */
export type MemberJoinEvent = Event;
/** @deprecated 协议中没有「成员离开域」事件码，该类型不会被派发。 */
export type MemberLeaveEvent = Event;
/** @deprecated 协议中没有「好友通过」事件码，该类型不会被派发。 */
export type FriendAcceptEvent = Event;
/** @deprecated 请改用 {@link RoleChangedEvent}（事件名为 "role.change"）。 */
export type RoleUpdateEvent = RoleChangedEvent;

// ── 事件联合类型 ─────────────────────────────────────

/** 所有事件类型的联合类型。 */
export type AnyEvent =
  | Event
  | MessageEvent
  | MessageDeleteEvent
  | ServerIdEvent
  | HeartbeatEvent
  | AuthEvent
  | FriendRequestEvent
  | FriendDeleteEvent
  | MessageReactionEvent
  | AreaDisableEvent
  | ChannelUpdateEvent
  | ChannelCreateEvent
  | ChannelDeleteEvent
  | VoicePresenceEvent
  | UserUpdateEvent
  | UserLoginStateEvent
  | AreaUpdateEvent
  | RoleChangedEvent;

/**
 * 事件名 → 事件类型的映射。
 *
 * `bot.on("message", handler)` 会据此把 handler 的参数类型收窄为
 * `MessageEvent`，从而可以直接访问 `event.message.content`。
 */
export interface EventMap {
  message: MessageEvent;
  "message.private": MessageEvent;
  "message.edit": MessageEvent;
  "message.private.edit": MessageEvent;
  recall: MessageDeleteEvent;
  "recall.private": MessageDeleteEvent;
  server_id: ServerIdEvent;
  heartbeat: HeartbeatEvent;
  auth: AuthEvent;
  "friend.request": FriendRequestEvent;
  "friend.delete": FriendDeleteEvent;
  "message.reaction": MessageReactionEvent;
  "moderation.voice_ban": AreaDisableEvent;
  "moderation.text_ban": AreaDisableEvent;
  "channel.update": ChannelUpdateEvent;
  "channel.create": ChannelCreateEvent;
  "channel.delete": ChannelDeleteEvent;
  "voice.enter": VoicePresenceEvent;
  "voice.leave": VoicePresenceEvent;
  "user.update": UserUpdateEvent;
  "user.login_state": UserLoginStateEvent;
  "area.update": AreaUpdateEvent;
  "role.change": RoleChangedEvent;
}
