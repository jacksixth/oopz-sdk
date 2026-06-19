import { BaseService } from "./base";
import type { MessageSendResult, PrivateSession, Message as MessageModel } from "../models";
import type { Segment } from "../models/segment";
import type { JsonObject } from "../models/base";
import type { OperationResult } from "../models/base";
import { success, failure } from "../models/base";

/**
 * 消息服务 
 */
export class Message extends BaseService {
  /**
   * 向频道发送消息�?
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
    }
  ): Promise<MessageSendResult> {
    this.requireParam(area, "area");
    this.requireParam(channel, "channel");

    let text: string;
    let attachments: JsonObject[] | undefined;

    if (typeof content === "string") {
      text = content;
    } else {
      text = content
        .map((s) => {
          if (s.type === "text") return s.text;
          if (s.type === "mention") return `@${s.userId}`;
          if (s.type === "mention_all") return "@all";
          if (s.type === "image" && s.uploaded) {
            return `![IMAGEw${s.uploaded.width || 0}h${s.uploaded.height || 0}](${s.uploaded.fileKey})`;
          }
          return "";
        })
        .join("");
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
      isMentionAll: options?.mentionAll ?? false,
      mentionList: options?.mentionUserIds ?? [],
      styleTags: [],
      referenceMessageId: options?.referenceMessageId ?? null,
      animated: false,
      displayName: "",
      duration: 0,
      attachments: options?.attachments ?? [],
    };

    const body = { message: messagePayload };
    const result = await this.transport.post<JsonObject>("/im/session/v2/sendGimMessage", body);
    return {
      messageId: (result["messageId"] || result["message_id"] || "") as string,
      timestamp: (result["timestamp"] || result["time"] || "") as string,
    };
  }

  async reply(
    area: string,
    channel: string,
    messageId: string,
    content: string | Segment[],
    options?: {
      attachments?: JsonObject[];
      mentionUserIds?: string[];
    }
  ): Promise<MessageSendResult> {
    return this.sendMessage(area, channel, content, {
      referenceMessageId: messageId,
      ...options,
    });
  }
  async editMessage(
    area: string,
    channel: string,
    messageId: string,
    content: string
  ): Promise<OperationResult> {
    this.requireParam(area, "area");
    this.requireParam(channel, "channel");
    this.requireParam(messageId, "messageId");

    const body: JsonObject = {
      areaId: area,
      channelId: channel,
      messageId,
      content,
    };

    try {
      await this.transport.post("/api/message/edit", body);
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

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
      return failure(String(err));
    }
  }

  async sendPrivateMessage(
    uid: string,
    content: string | Segment[],
    options?: {
      attachments?: JsonObject[];
    }
  ): Promise<MessageSendResult> {
    this.requireParam(uid, "uid");

    const text = typeof content === "string" ? content : "";
    const clientMessageId = this.signer.clientMessageId();
    const timestamp = this.signer.timestampUs();

    const messagePayload: JsonObject = {
      area: "",
      channel: "", // will be filled by open_private_session if needed
      target: uid,
      text,
      content: text,
      clientMessageId,
      timestamp,
      isMentionAll: false,
      mentionList: [],
      styleTags: [],
      referenceMessageId: null,
      animated: false,
      displayName: "",
      duration: 0,
      attachments: options?.attachments ?? [],
    };

    const body = { message: messagePayload };
    const result = await this.transport.post<JsonObject>("/im/session/v2/sendImMessage", body);
    return {
      messageId: (result["messageId"] || result["message_id"] || "") as string,
      timestamp: (result["timestamp"] || result["time"] || "") as string,
    };
  }


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

    const result = await this.transport.get<JsonObject>(
      `/im/session/v2/messageBefore?${params.toString()}`
    );

    const messages = (result["messages"] || result["data"] || []) as JsonObject[];
    return messages.map((m) => ({
      messageId: (m["messageId"] || m["id"] || "") as string,
      senderUid: (m["senderUid"] || m["senderId"] || "") as string,
      senderNickname: m["senderNickname"] as string | undefined,
      senderAvatar: m["senderAvatar"] as string | undefined,
      content: (m["content"] || "") as string,
      timestamp: (m["timestamp"] || "") as string,
      areaId: area,
      channelId: channel,
    }));
  }

  async getPrivateSessions(): Promise<PrivateSession[]> {
    const result = await this.transport.get<JsonObject>("/api/message/private/list");
    const sessions = (result["sessions"] || result["data"] || []) as JsonObject[];
    return sessions.map((s) => ({
      uid: (s["uid"] || "") as string,
      sessionId: (s["sessionId"] || s["session_id"] || "") as string,
      lastTime: s["lastTime"] as string | undefined,
      mute: s["mute"] as boolean | undefined,
    }));
  }
}
