import { BaseService } from "./base";
import type {
  ChannelSetting,
  CreateChannelResult,
  ChannelEdit,
  VoiceChannelMembersResult,
  VoiceChannelMemberInfo,
  ChannelSign,
} from "../models";
import { ChannelType } from "../models";
import type { OperationResult } from "../models/base";
import { success, failure } from "../models/base";
import type { JsonObject } from "../models/base";

/** 语音频道类型标识。 */
const VOICE_TYPES = new Set(["VOICE", "AUDIO"]);

/**
 * 频道服务 — 创建、编辑、删除频道、语音频道进出。
 */
export class Channel extends BaseService {
  /**
   * 获取频道信息（对齐 Python get_channel_setting_info）。
   */
  async getChannel(areaId: string, channelId: string): Promise<ChannelSetting | null> {
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
        isPrivate: data["secret"] as boolean | undefined,
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
   * 进入频道（对齐 Python enter_channel）。
   *
   * 语音频道（channelType = "VOICE"）会返回 ChannelSign，供语音客户端使用。
   */
  async enterChannel(
    areaId: string,
    channelId: string,
    channelType: string = "TEXT",
    options?: { fromArea?: string; fromChannel?: string; pid?: string },
  ): Promise<ChannelSign> {
    this.requireParam(areaId, "areaId");
    this.requireParam(channelId, "channelId");

    const body: JsonObject = {
      type: channelType,
      area: areaId,
      channel: channelId,
    };

    if (channelType === "VOICE") {
      body["fromChannel"] = options?.fromChannel ?? "";
      body["fromArea"] = options?.fromArea ?? "";
      body["password"] = "";
      body["sign"] = 1;
      body["pid"] = options?.pid ?? this.config.personUid;
    }

    const result = await this.transport.post<JsonObject>("/area/v2/channel/enter", body);
    const data = (result["data"] || result) as JsonObject;

    return {
      rtcToken: (data["supplierSign"] || data["userSign"] || "") as string,
      rtcChannelName: (data["roomId"] || "") as string,
      roomId: (data["roomId"] || "") as string,
      supplierSign: (data["supplierSign"] || "") as string,
      // 服务端未返回 appId 时回落到配置里的 Agora App ID
      appId: (data["appId"] || this.config.agoraAppId || 0) as number,
      userSign: (data["userSign"] || "") as string,
      supplier: (data["supplier"] || "") as string,
      expireSeconds: (data["expireSeconds"] || 86400) as number,
    };
  }

  /**
   * 退出语音频道（对齐 Python leave_voice_channel）。
   */
  async leaveVoiceChannel(
    areaId: string,
    channelId: string,
    target?: string,
  ): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(channelId, "channelId");

    const resolvedTarget = target || this.config.personUid;
    this.requireParam(resolvedTarget, "target");

    try {
      const params = new URLSearchParams({
        area: areaId,
        channel: channelId,
        target: resolvedTarget,
      });
      await this.transport.del(
        `/client/v1/area/v1/member/v1/removeFromChannel?${params}`
      );
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 创建新频道（对齐 Python create_channel）。
   *
   * 未指定 groupId 时会自动取区域内第一个频道分组。
   */
  async createChannel(
    areaId: string,
    name: string,
    type: ChannelType = ChannelType.TEXT,
    options?: { groupId?: string; position?: number }
  ): Promise<CreateChannelResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(name, "name");

    let groupId = options?.groupId ?? "";
    if (!groupId) {
      const groups = await this.owner.areas.getAreaChannels(areaId);
      if (groups.length >= 1) {
        groupId = groups[0].groupId;
      } else {
        throw new Error("no channel group found in area, groupId is required");
      }
    }

    const body: JsonObject = {
      area: areaId,
      group: groupId,
      name,
      type,
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
      return failure(errorMessage(err));
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
      return failure(errorMessage(err));
    }
  }
}

/** 提取错误信息文本（优先 err.message）。 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
