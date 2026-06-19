/** 每次 API 请求附带的默认 HTTP 头（对齐 Python SDK 浏览器模拟）。 */
export const DEFAULT_HEADERS: Record<string, string> = {
  "Accept": "*/*",
  "Accept-Encoding": "gzip, deflate",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "Cache-Control": "no-cache",
  "Content-Type": "application/json;charset=utf-8",
  "Origin": "https://web.oopz.cn",
  "Pragma": "no-cache",
  "Priority": "u=1, i",
  "Sec-Ch-Ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": "\"Windows\"",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/140.0.0.0 Safari/537.36",
};

/** WebSocket 事件码（Oopz 协议，对齐 Python SDK）。 */
export const EVENT_SERVER_ID = 1;
export const EVENT_FRIEND_REQUEST = 2;
export const EVENT_FRIEND_DELETE = 4;
export const EVENT_PRIVATE_MESSAGE_DELETE = 6;
export const EVENT_PRIVATE_MESSAGE = 7;
export const EVENT_MESSAGE_DELETE = 8;
export const EVENT_CHAT_MESSAGE = 9;
export const EVENT_CHANNEL_VOICE_BAN = 11;
export const EVENT_CHANNEL_MESSAGE_BAN = 12;
export const EVENT_CHANNEL_DELETE = 13;
export const EVENT_CHANNEL_UPDATE = 18;
export const EVENT_USER_LEAVE_VOICE_CHANNEL = 19;
export const EVENT_USER_ENTER_VOICE_CHANNEL = 20;
export const EVENT_PUBLIC_CHANNEL_CREATE = 25;
export const EVENT_USER_UPDATE = 26;
export const EVENT_USER_LOGIN_STATE_CHANGED = 27;
export const EVENT_AREA_UPDATE = 28;
export const EVENT_MESSAGE_REACTION = 32;
export const EVENT_ROLE_CHANGED = 52;
export const EVENT_PRIVATE_MESSAGE_EDIT = 56;
export const EVENT_MESSAGE_EDIT = 57;
export const EVENT_SUBSCRIBE_AREA_EVENTS = 249;
export const EVENT_AUTH = 253;
export const EVENT_HEARTBEAT = 254;

/** 标签样式常量。 */
export const STYLE_TAG_IMPORTANT = "important";
export const STYLE_TAGS = [
  "important",
  "warning",
  "info",
  "success",
  "error",
] as const;

/** 附件类型常量。 */
export const ATTACHMENT_TYPE_IMAGE = "image";
export const ATTACHMENT_TYPE_AUDIO = "audio";
export const ATTACHMENT_TYPE_FILE = "file";

/** Oopz API 事件码 → SDK 事件名映射（对齐 Python SDK）。 */
export const EVENT_CODE_MAP: Record<number, string> = {
  [EVENT_SERVER_ID]: "server_id",
  [EVENT_FRIEND_REQUEST]: "friend.request",
  [EVENT_FRIEND_DELETE]: "friend.delete",
  [EVENT_PRIVATE_MESSAGE_DELETE]: "recall.private",
  [EVENT_PRIVATE_MESSAGE]: "message.private",
  [EVENT_MESSAGE_DELETE]: "recall",
  [EVENT_CHAT_MESSAGE]: "message",
  [EVENT_CHANNEL_VOICE_BAN]: "moderation.voice_ban",
  [EVENT_CHANNEL_MESSAGE_BAN]: "moderation.text_ban",
  [EVENT_CHANNEL_DELETE]: "channel.delete",
  [EVENT_CHANNEL_UPDATE]: "channel.update",
  [EVENT_USER_LEAVE_VOICE_CHANNEL]: "voice.leave",
  [EVENT_USER_ENTER_VOICE_CHANNEL]: "voice.enter",
  [EVENT_PUBLIC_CHANNEL_CREATE]: "channel.create",
  [EVENT_USER_UPDATE]: "user.update",
  [EVENT_USER_LOGIN_STATE_CHANGED]: "user.login_state",
  [EVENT_AREA_UPDATE]: "area.update",
  [EVENT_MESSAGE_REACTION]: "message.reaction",
  [EVENT_ROLE_CHANGED]: "role.change",
  [EVENT_PRIVATE_MESSAGE_EDIT]: "message.private.edit",
  [EVENT_MESSAGE_EDIT]: "message.edit",
  [EVENT_SUBSCRIBE_AREA_EVENTS]: "subscribe",
  [EVENT_AUTH]: "auth",
  [EVENT_HEARTBEAT]: "heartbeat",
};
