import { BaseService } from "./base";
import type {
  ChannelSetting,
  CreateChannelResult,
  ChannelEdit,
  VoiceChannelMembersResult,
  VoiceChannelMemberInfo,
} from "../models";
import { ChannelType } from "../models";
import type { OperationResult } from "../models/base";
import { success, failure } from "../models/base";
import type { JsonObject } from "../models/base";

/** 语音频道类型标识。 */
const VOICE_TYPES = new Set(["VOICE", "AUDIO"]);

/**
 * 频道服务 — 创建、编辑、删除频道。
 */
export class Channel extends BaseService {
  /**
   * 获取频道信息。
   */
  async getChannel(areaId: string, channelId: string): Promise<ChannelSetting | null> {
    this.requireParam(areaId, "areaId");
    this.requireParam(channelId, "channelId");

    try {
      const params = new URLSearchParams({ channel: channelId });
      const result = await this.transport.get<JsonObject>(
        `/area/v3/channel/setting/info?${params}`
      );
      return {
        channelId: (result["channelId"] || channelId) as string,
        areaId: (result["areaId"] || areaId) as string,
        name: (result["name"] || "") as string,
        type: (result["type"] || 0) as ChannelType,
        groupId: result["groupId"] as string | undefined,
        position: result["position"] as number | undefined,
        topic: result["topic"] as string | undefined,
        isPrivate: result["isPrivate"] as boolean | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * 列出区域内的频道。
   */
  async listChannels(areaId: string): Promise<ChannelSetting[]> {
    this.requireParam(areaId, "areaId");

    const params = new URLSearchParams({ area: areaId });
    const result = await this.transport.get<JsonObject>(
      `/client/v1/area/v1/detail/v1/channels?${params}`
    );
    const channels = (result["channels"] || result["data"] || []) as JsonObject[];
    return channels.map((c) => ({
      channelId: (c["channelId"] || c["id"] || "") as string,
      areaId: (c["areaId"] || areaId) as string,
      name: (c["name"] || "") as string,
      type: (c["type"] || 0) as ChannelType,
      groupId: c["groupId"] as string | undefined,
      position: c["position"] as number | undefined,
      topic: c["topic"] as string | undefined,
      isPrivate: c["isPrivate"] as boolean | undefined,
    }));
  }

  /**
   * 获取区域内各语音频道的在线成员（对齐 Python get_voice_channel_members）。
   */
  async getVoiceChannelMembers(areaId: string): Promise<VoiceChannelMembersResult> {
    this.requireParam(areaId, "areaId");

    // 先获取区域频道列表，从中提取语音频道 ID
    const groups = await this.owner.areas.getAreaChannels(areaId);
    const voiceIds: string[] = [];
    for (const g of groups) {
      for (const ch of g.channels) {
        if (VOICE_TYPES.has(ch.type)) {
          voiceIds.push(ch.channelId);
        }
      }
    }

    if (voiceIds.length === 0) {
      return { channelMembers: {} };
    }

    const body = { area: areaId, channels: voiceIds };
    const result = await this.transport.post<JsonObject>(
      "/area/v3/channel/membersByChannels",
      body
    );

    // API 响应格式: {"status": true, "data": {"channelMembers": {"ch1": [...], "ch2": [...]}}}
    // 对齐 Python _request_data: 先取 data 字段
    const data = (result["data"] || result) as JsonObject;
    const raw = (data["channelMembers"] || {}) as Record<string, JsonObject[]>;
    const channelMembers: Record<string, VoiceChannelMemberInfo[]> = {};

    for (const [chId, members] of Object.entries(raw)) {
      if (!Array.isArray(members)) continue;
      channelMembers[chId] = members.map((m) => ({
        uid: (m["uid"] || "") as string,
        botType: (m["botType"] || "") as string,
        dimensions: (m["dimensions"] || "") as string,
        enterTime: (m["enterTime"] || "") as string,
        framerate: (m["framerate"] || "") as string,
        isBot: (m["isBot"] || false) as boolean,
        peopleLimit: (m["peopleLimit"] || 0) as number,
        screenSharingState: (m["screenSharingState"] || "") as string,
        screenType: (m["screenType"] || "") as string,
        sort: (m["sort"] || 0) as number,
      }));
    }

    return { channelMembers };
  }

  /**
   * 创建新频道。
   */
  async createChannel(
    areaId: string,
    name: string,
    type: ChannelType = ChannelType.TEXT,
    options?: { groupId?: string; position?: number }
  ): Promise<CreateChannelResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(name, "name");

    const body: JsonObject = {
      area: areaId,
      name,
      type,
      group: options?.groupId ?? "",
      secret: false,
      maxMember: 100,
    };

    const result = await this.transport.post<JsonObject>("/client/v1/area/v1/channel/v1/create", body);
    return {
      channelId: (result["channelId"] || result["id"] || "") as string,
      name: (result["name"] || name) as string,
      type: (result["type"] || type) as ChannelType,
    };
  }

  /**
   * 编辑频道设置。
   */
  async editChannel(
    areaId: string,
    channelId: string,
    edits: ChannelEdit
  ): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(channelId, "channelId");

    const body: JsonObject = { area: areaId, channel: channelId, ...edits };

    try {
      await this.transport.post("/area/v3/channel/setting/edit", body);
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /**
   * 删除频道。
   */
  async deleteChannel(areaId: string, channelId: string): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(channelId, "channelId");

    try {
      const params = new URLSearchParams({ area: areaId, channel: channelId });
      await this.transport.requestJson("DELETE", `/client/v1/area/v1/channel/v1/delete?${params}`);
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }
}
