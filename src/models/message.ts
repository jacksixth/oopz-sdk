import type { Attachment } from "./attachment";
import type { JsonObject } from "./base";

// ── 消息 ─────────────────────────────────────────────

/** 从 Oopz 接收的消息对象。 */
export interface Message {
  messageId: string;
  areaId?: string;
  channelId?: string;
  senderUid: string;
  senderNickname?: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  editedTimestamp?: string;
  attachments?: Attachment[];
  mentions?: string[];
  mentionAll?: boolean;
  reference?: MessageReference;
  privateSessionId?: string;
  /** 原始 API 数据，用于高级访问。 */
  _raw?: JsonObject;
}

/** 被引用的回复消息引用。 */
export interface MessageReference {
  messageId: string;
  senderUid?: string;
  senderNickname?: string;
  content?: string;
}

/** 发送消息后返回的结果。 */
export interface MessageSendResult {
  messageId: string;
  timestamp: string;
}

/** 消息附带的媒体信息（视频预览、原始视频）。 */
export interface MediaInfo {
  fileKey: string;
  fileSize?: number;
  hash?: string;
  url?: string;
  width?: number;
  height?: number;
}

// ── 私信会话 ─────────────────────────────────────

export interface PrivateSession {
  uid: string;
  sessionId: string;
  lastTime?: string;
  mute?: boolean;
}

// ── 消息表情 ────────────────────────────

export interface MessageEmojiItem {
  emoji: string;
  count: number;
  uids: string[];
}
