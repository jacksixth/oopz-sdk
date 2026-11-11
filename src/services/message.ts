import { BaseService } from "./base";
import type { MessageSendResult, PrivateSession, Message as MessageModel } from "../models";
import type { Segment } from "../models/segment";
import { buildSegments, normalizeMessageParts } from "../models/segment";
import type { JsonObject } from "../models/base";
import type { OperationResult } from "../models/base";
import { success, failure } from "../models/base";
import { normalizeReactionEmoji } from "../utils/reaction-emoji";

/**
 * 消息服务。
 *
 * 对齐 Python SDK 的 `Message`：发送/回复频道消息、私信、撤回、历史消息。
 */
export class Message extends BaseService {
  /**
   * 向频道发送消息。
   *
   * `content` 可以是字符串，也可以是 Segment 数组（文本 / @提及 / @全体 / 图片）。
   * 使用 Segment 时，图片分段必须先通过 `bot.media.uploadImage()` 上传，
   * 并把结果写回 `segment.uploaded`。
   */
  async sendMessage(
    area: string,
    channel: string,
    content: string | Segment[],
    options?: {
      referenceMessageId?: string;
      attachments?: JsonObject[];
      mentionUserIds?: string[];
      mentionAll?: boolean;
      styleTags?: string[];
    }
  ): Promise<MessageSendResult> {
    this.requireParam(area, "area");
    this.requireParam(channel, "channel");

    const { text, attachments: segmentAttachments } = this.buildContent(content);

    // Segment 里的 @提及 / @全体 也要进入 mentionList / isMentionAll，
    // 否则服务端不会把它当成真正的提及（仅文本里的 @xxx 不生效）。
    const mentionUserIds = new Set(options?.mentionUserIds ?? []);
    let mentionAll = options?.mentionAll ?? false;
    for (const seg of Array.isArray(content) ? content : []) {
      if (seg.type === "mention") {
        mentionUserIds.add(seg.userId);
      } else if (seg.type === "mention_all") {
        mentionAll = true;
      }
    }

    const clientMessageId = this.signer.clientMessageId();
    const timestamp = this.signer.timestampUs();

    const messagePayload: JsonObject = {
      area: area,
      channel: channel,
      target: "",
      text: text,
      content: text,
      clientMessageId,
      timestamp,
      isMentionAll: mentionAll,
      mentionList: [...mentionUserIds],
      styleTags: options?.styleTags ?? this.defaultStyleTags(),
      referenceMessageId: options?.referenceMessageId ?? null,
      animated: false,
      displayName: "",
      duration: 0,
      attachments: [...(options?.attachments ?? []), ...segmentAttachments],
    };

    const body = { message: messagePayload };
    const result = await this.transport.post<JsonObject>("/im/session/v2/sendGimMessage", body);
    const data = (result["data"] || result) as JsonObject;
    return {
      messageId: (data["messageId"] || data["message_id"] || "") as string,
      timestamp: (data["timestamp"] || data["time"] || "") as string,
    };
  }

  /**
   * 回复频道消息（自动引用被回复的消息）。
   */
  async reply(
    area: string,
    channel: string,
    messageId: string,
    content: string | Segment[],
    options?: {
      attachments?: JsonObject[];
      mentionUserIds?: string[];
      mentionAll?: boolean;
    }
  ): Promise<MessageSendResult> {
    this.requireParam(messageId, "messageId");
    return this.sendMessage(area, channel, content, {
      referenceMessageId: messageId,
      ...options,
    });
  }

  /**
   * 打开或创建与指定用户的私信会话。
   * 对齐 Python SDK 的 `open_private_session`。
   */
  async openPrivateSession(target: string): Promise<PrivateSession> {
    this.requireParam(target, "target");
    const result = await this.transport.patch<JsonObject>(
      "/client/v1/chat/v1/to?target=" + encodeURIComponent(target)
    );
    const data = (result["data"] || result) as JsonObject;
    return {
      uid: (data["uid"] || target) as string,
      sessionId: (data["sessionId"] || data["session_id"] || "") as string,
      lastTime: data["lastTime"] as string | undefined,
      mute: data["mute"] as boolean | undefined,
    };
  }

  /**
   * 发送私信。
   *
   * 若未提供 `channel`，会自动打开与目标用户的私信会话（对齐 Python SDK）。
   */
  async sendPrivateMessage(
    uid: string,
    content: string | Segment[],
    options?: {
      channel?: string;
      attachments?: JsonObject[];
      mentionUserIds?: string[];
      mentionAll?: boolean;
    }
  ): Promise<MessageSendResult> {
    this.requireParam(uid, "uid");

    const { text, attachments: segmentAttachments } = this.buildContent(content);

    const mentionUserIds = new Set(options?.mentionUserIds ?? []);
    let mentionAll = options?.mentionAll ?? false;
    for (const seg of Array.isArray(content) ? content : []) {
      if (seg.type === "mention") {
        mentionUserIds.add(seg.userId);
      } else if (seg.type === "mention_all") {
        mentionAll = true;
      }
    }

    // 没有指定会话 ID 时，先打开私信会话拿到 sessionId
    let channel = options?.channel ?? "";
    if (!channel) {
      const session = await this.openPrivateSession(uid);
      if (!session.sessionId) {
        throw new Error(`Failed to open private session for target=${uid}`);
      }
      channel = session.sessionId;
    }

    const clientMessageId = this.signer.clientMessageId();
    const timestamp = this.signer.timestampUs();

    const messagePayload: JsonObject = {
      area: "",
      channel: channel,
      target: uid,
      text: text,
      content: text,
      clientMessageId,
      timestamp,
      isMentionAll: mentionAll,
      mentionList: [...mentionUserIds],
      styleTags: this.defaultStyleTags(),
      referenceMessageId: null,
      animated: false,
      displayName: "",
      duration: 0,
      attachments: [...(options?.attachments ?? []), ...segmentAttachments],
    };

    const body = { message: messagePayload };
    const result = await this.transport.post<JsonObject>("/im/session/v2/sendImMessage", body);
    const data = (result["data"] || result) as JsonObject;
    return {
      messageId: (data["messageId"] || data["message_id"] || "") as string,
      timestamp: (data["timestamp"] || data["time"] || "") as string,
    };
  }

  /**
   * 撤回频道消息（对齐 Python recall_message）。
   */
  async recall(
    area: string,
    channel: string,
    messageId: string
  ): Promise<OperationResult> {
    this.requireParam(area, "area");
    this.requireParam(channel, "channel");
    this.requireParam(messageId, "messageId");

    const body: JsonObject = {
      area,
      channel,
      messageId,
      timestamp: this.signer.timestampUs(),
      target: "",
    };

    try {
      await this.transport.post("/im/session/v1/recallGim", body);
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 撤回私信。
   * 对齐 Python SDK 的 `recall_private_message`。
   */
  async recallPrivateMessage(
    messageId: string,
    target: string,
    channel?: string,
    area?: string
  ): Promise<OperationResult> {
    this.requireParam(messageId, "messageId");
    this.requireParam(target, "target");

    let resolvedChannel = channel ?? "";
    if (!resolvedChannel) {
      const session = await this.openPrivateSession(target);
      resolvedChannel = session.sessionId;
    }

    const body: JsonObject = {
      area: area ?? "",
      channel: resolvedChannel,
      messageId,
      timestamp: this.signer.timestampUs(),
      target,
    };

    try {
      await this.transport.post("/im/session/v1/recallIm", body);
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 置顶 / 取消置顶消息（对齐 Python top_message）。
   */
  async topMessage(
    messageId: string,
    area: string,
    channel: string,
    top: boolean = true
  ): Promise<OperationResult> {
    this.requireParam(messageId, "messageId");
    this.requireParam(area, "area");
    this.requireParam(channel, "channel");

    try {
      await this.transport.post("/im/session/v1/messageTop", {
        messageId,
        area,
        channel,
        topMessage: top,
      });
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 添加频道消息表情（对齐 Python add_channel_reaction）。
   */
  async addChannelReaction(
    messageId: string,
    channel: string,
    emoji: string,
    area: string = ""
  ): Promise<OperationResult> {
    this.requireParam(messageId, "messageId");
    this.requireParam(channel, "channel");
    this.requireParam(emoji, "emoji");

    try {
      await this.transport.post("/im/session/v1/gimReaction", {
        messageId,
        channel,
        emoji: normalizeReactionEmoji(emoji),
        area,
      });
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 撤回频道消息表情（对齐 Python withdraw_channel_reaction）。
   */
  async withdrawChannelReaction(
    messageId: string,
    channel: string,
    emoji: string,
    area: string = ""
  ): Promise<OperationResult> {
    this.requireParam(messageId, "messageId");
    this.requireParam(channel, "channel");
    this.requireParam(emoji, "emoji");

    try {
      await this.transport.post("/im/session/v1/gimReaction", {
        messageId,
        channel,
        emoji: normalizeReactionEmoji(emoji),
        area,
        type: "cancel",
      });
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 获取频道历史消息。
   */
  async getMessages(
    area: string,
    channel: string,
    options?: {
      before?: string;
      after?: string;
      limit?: number;
    }
  ): Promise<MessageModel[]> {
    this.requireParam(area, "area");
    this.requireParam(channel, "channel");

    const params = new URLSearchParams();
    params.set("area", area);
    params.set("channel", channel);
    if (options?.limit) params.set("size", String(options.limit));
    if (options?.before) params.set("before", options.before);
    if (options?.after) params.set("after", options.after);

    const result = await this.transport.get<JsonObject>(
      `/im/session/v2/messageBefore?${params.toString()}`
    );

    const data = (result["data"] || result) as JsonObject;
    const messages = (data["messages"] || []) as JsonObject[];
    return messages.map((m) => ({
      messageId: (m["messageId"] || m["id"] || "") as string,
      senderUid: (m["person"] || m["senderUid"] || m["senderId"] || "") as string,
      senderNickname: m["senderNickname"] as string | undefined,
      senderAvatar: m["senderAvatar"] as string | undefined,
      content: (m["content"] || m["text"] || "") as string,
      timestamp: (m["timestamp"] || "") as string,
      areaId: area,
      channelId: channel,
    }));
  }

  /**
   * 把字符串或 Segment 数组统一编译成 (text, attachments)。
   */
  private buildContent(content: string | Segment[]): {
    text: string;
    attachments: JsonObject[];
  } {
    if (typeof content === "string") {
      return { text: content, attachments: [] };
    }

    const segments = normalizeMessageParts(content);
    const built = buildSegments(segments);
    return {
      text: built.text,
      attachments: built.attachments as unknown as JsonObject[],
    };
  }

  /**
   * 默认样式标签：开启公告样式时附加 IMPORTANT（对齐 Python SDK）。
   */
  private defaultStyleTags(): string[] {
    return this.config.useAnnouncementStyle ? ["IMPORTANT"] : [];
  }
}

/** 提取错误信息文本（优先 err.message）。 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
