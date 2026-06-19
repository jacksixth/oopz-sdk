import { BaseService } from "./base";
import type { JoinedAreaInfo, AreaMembersPage, AreaUserDetail, ChannelGroupInfo, ChannelInfo } from "../models";
import type { JsonObject } from "../models/base";

/** 频道类型名称映射（对齐 Python ChannelType）。 */
const CHANNEL_TYPE_MAP: Record<string, string> = {
  TEXT: "文字",
  VOICE: "语音",
  AUDIO: "语音",
};

/**
 * 区域服务 — 列出区域、加入、离开、管理成员。
 * API 路径对齐 Python SDK (tangqingfeng7/Oopzbot-SDK)
 */
export class AreaService extends BaseService {
  /** 列出机器人已加入的所有区域。 */
  async getJoinedAreas(): Promise<JoinedAreaInfo[]> {
    const result = await this.transport.get<JsonObject>("/userSubscribeArea/v1/list");
    const areas = (result["areas"] || result["data"] || result) as JsonObject[];
    return (Array.isArray(areas) ? areas : []).map((a) => ({
      areaId: (a["areaId"] || a["area_id"] || a["id"] || "") as string,
      name: (a["name"] || "") as string,
      icon: a["icon"] as string | undefined,
      ownerUid: a["ownerUid"] as string | undefined,
      memberCount: a["memberCount"] as number | undefined,
      description: a["description"] as string | undefined,
      joinedAt: a["joinedAt"] as string | undefined,
    }));
  }

  /**
   * 获取区域内的频道分组及子频道（对齐 Python get_area_channels）。
   * 返回频道分组列表，每个分组包含其下的子频道（房间）。
   */
  async getAreaChannels(areaId: string): Promise<ChannelGroupInfo[]> {
    this.requireParam(areaId, "areaId");
    const params = new URLSearchParams({ area: areaId });
    const result = await this.transport.get<JsonObject[]>(
      `/client/v1/area/v1/detail/v1/channels?${params}`
    );

    // API 返回数组，每个元素是一个分组
    const groups = (Array.isArray(result) ? result : (result as any)["data"] || []) as JsonObject[];

    return groups.map((g) => ({
      groupId: (g["id"] || g["groupId"] || "") as string,
      name: (g["name"] || "") as string,
      sort: (g["sort"] || 0) as number,
      system: (g["system"] || false) as boolean,
      area: (g["area"] || areaId) as string,
      isEnableTemp: (g["isEnableTemp"] || g["IsEnableTemp"] || false) as boolean,
      channels: ((g["channels"] || []) as JsonObject[]).map((ch): ChannelInfo => ({
        channelId: (ch["id"] || ch["channelId"] || "") as string,
        areaId: (ch["areaId"] || areaId) as string,
        groupId: (ch["groupId"] || g["id"] || "") as string,
        name: (ch["name"] || "") as string,
        type: (ch["type"] || "TEXT") as string,
        number: (ch["number"] || 0) as number,
        secret: (ch["secret"] || false) as boolean,
        system: (ch["system"] || false) as boolean,
        tag: (ch["tag"] || "") as string,
        isTemp: (ch["isTemp"] || false) as boolean,
      })),
    }));
  }

  /** 获取区域详细信息。 */
  async getAreaInfo(areaId: string): Promise<JoinedAreaInfo | null> {
    this.requireParam(areaId, "areaId");
    try {
      const params = new URLSearchParams({ area: areaId });
      const result = await this.transport.get<JsonObject>(`/area/v3/info?${params}`);
      const data = (result["data"] || result) as JsonObject;
      return {
        areaId: (data["areaId"] || data["id"] || areaId) as string,
        name: (data["name"] || "") as string,
        icon: data["icon"] as string | undefined,
        ownerUid: data["ownerUid"] as string | undefined,
        memberCount: data["memberCount"] as number | undefined,
        description: data["description"] as string | undefined,
      };
    } catch {
      return null;
    }
  }

  /** 获取区域成员分页列表。 */
  async getMembers(
    areaId: string,
    options?: { offset?: number; limit?: number }
  ): Promise<AreaMembersPage> {
    this.requireParam(areaId, "areaId");
    const offsetStart = options?.offset ?? 0;
    const offsetEnd = offsetStart + (options?.limit ?? 50) - 1;

    const params = new URLSearchParams({
      area: areaId,
      offsetStart: String(offsetStart),
      offsetEnd: String(offsetEnd),
    });
    const result = await this.transport.get<JsonObject>(`/area/v3/members?${params}`);

    const members = (result["members"] || result["data"] || []) as JsonObject[];
    return {
      members: members.map((m) => ({
        uid: (m["uid"] || "") as string,
        nickname: m["nickname"] as string | undefined,
        avatar: m["avatar"] as string | undefined,
        roleId: m["roleId"] as string | undefined,
        joinedAt: m["joinedAt"] as string | undefined,
      })),
      total: (result["totalCount"] || result["total"] || 0) as number,
      offset: options?.offset,
      limit: options?.limit,
    };
  }

  /** 获取用户在区域内的详细信息。 */
  async getUserDetail(areaId: string, uid: string): Promise<AreaUserDetail | null> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      const params = new URLSearchParams({ area: areaId, target: uid });
      const result = await this.transport.get<JsonObject>(`/area/v3/userDetail?${params}`);
      return {
        uid: (result["uid"] || uid) as string,
        nickname: (result["nickname"] || "") as string,
        avatar: result["avatar"] as string | undefined,
        roles: (result["roles"] || []) as AreaUserDetail["roles"],
        joinedAt: result["joinedAt"] as string | undefined,
      };
    } catch {
      return null;
    }
  }
}
