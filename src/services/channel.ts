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
      const data = (result["data"] || result) as JsonObject;
      return {
        channelId: (data["channelId"] || channelId) as string,
        areaId: (data["areaId"] || areaId) as string,
        name: (data["name"] || "") as string,
        type: (data["type"] || 0) as ChannelType,
        groupId: data["groupId"] as string | undefined,
        position: data["position"] as number | undefined,
        topic: data["topic"] as string | undefined,
        isPrivate: data["isPrivate"] as boolean | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * 列出区域内的所有频道（扁平列表，对齐 Python get_area_channels 后展平）。
   * 注意：API 返回频道分组，本方法将其展平为 ChannelSetting 列表。
   */
  async listChannels(areaId: string): Promise<ChannelSetting[]> {
    this.requireParam(areaId, "areaId");

    const groups = await this.owner.areas.getAreaChannels(areaId);
    const result: ChannelSetting[] = [];
    for (const g of groups) {
      for (const ch of g.channels) {
        result.push({
          channelId: ch.channelId,
          areaId: ch.areaId,
          name: ch.name,
          type: ch.type === "VOICE" || ch.type === "AUDIO" ? ChannelType.VOICE : ChannelType.TEXT,
          groupId: ch.groupId,
          position: ch.number,
          topic: undefined,
          isPrivate: ch.secret,
        });
      }
    }
    return result;
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
    const data = (result["data"] || result) as JsonObject;
    return {
      channelId: (data["channelId"] || data["id"] || "") as string,
      name: (data["name"] || name) as string,
      type: (data["type"] || type) as ChannelType,
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
