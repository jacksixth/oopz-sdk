import { BaseService } from "./base";
import type {
  JoinedAreaInfo,
  AreaMembersPage,
  AreaUserDetail,
  ChannelGroupInfo,
  ChannelInfo,
  AreaRoleInfo,
  RoleInfo,
} from "../models";
import type { JsonObject } from "../models/base";
import { coerceBool } from "../utils/payload";

/**
 * 区域服务 — 列出区域、加入、离开、管理成员。
 * API 路径对齐 Python SDK (tangqingfeng7/Oopzbot-SDK)
 */
export class AreaService extends BaseService {
  /** 列出机器人已加入的所有区域。 */
  async getJoinedAreas(): Promise<JoinedAreaInfo[]> {
    const result = await this.transport.get<JsonObject>(
      "/userSubscribeArea/v1/list",
    );
    const areas = (result["areas"] || result["data"] || result) as JsonObject[];
    return (Array.isArray(areas) ? areas : []).map((a) => ({
      areaId: (a["areaId"] || a["id"] || "") as string,
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

    // 读缓存
    const cached = this.cache.getAreaChannels(areaId);
    if (cached) return cached;

    const params = new URLSearchParams({ area: areaId });
    const result = await this.transport.get<JsonObject>(
      `/client/v1/area/v1/detail/v1/channels?${params}`,
    );

    // API 返回数组，每个元素是一个分组
    const groups = (
      Array.isArray(result) ? result : (result as any)["data"] || []
    ) as JsonObject[];

    const mapped = groups.map((g) => ({
      groupId: (g["id"] || g["groupId"] || "") as string,
      name: (g["name"] || "") as string,
      sort: (g["sort"] || 0) as number,
      system: coerceBool(g["system"], false),
      area: (g["area"] || areaId) as string,
      isEnableTemp: coerceBool(
        g["isEnableTemp"] ?? g["IsEnableTemp"],
        false
      ),
      channels: ((g["channels"] || []) as JsonObject[]).map(
        (ch): ChannelInfo => ({
          channelId: (ch["id"] || ch["channelId"] || "") as string,
          areaId: (ch["areaId"] || areaId) as string,
          groupId: (ch["groupId"] || g["id"] || "") as string,
          name: (ch["name"] || "") as string,
          type: (ch["type"] || "TEXT") as string,
          number: (ch["number"] || 0) as number,
          secret: coerceBool(ch["secret"], false),
          system: coerceBool(ch["system"], false),
          tag: (ch["tag"] || "") as string,
          isTemp: coerceBool(ch["isTemp"], false),
        }),
      ),
    }));

    // 写缓存
    this.cache.setAreaChannels(areaId, mapped);

    return mapped;
  }

  /** 获取区域详细信息。 */
  async getAreaInfo(areaId: string): Promise<JoinedAreaInfo | null> {
    this.requireParam(areaId, "areaId");
    try {
      const params = new URLSearchParams({ area: areaId });
      const result = await this.transport.get<JsonObject>(
        `/area/v3/info?${params}`,
      );
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

  /**
   * 获取区域成员分页列表。
   *
   * 对齐 Python get_area_members：使用 request_data_with_retry + retry_on_429，
   * 并缓存分页结果。
   */
  async getMembers(
    areaId: string,
    options?: { offset?: number; limit?: number; force?: boolean },
  ): Promise<AreaMembersPage> {
    this.requireParam(areaId, "areaId");
    const offsetStart = options?.offset ?? 0;
    const offsetEnd = offsetStart + (options?.limit ?? 50) - 1;

    // 读缓存
    if (!options?.force) {
      const cached = this.cache.getAreaMembersPage(areaId, offsetStart, offsetEnd);
      if (cached) return cached;
    }

    const params = new URLSearchParams({
      area: areaId,
      offsetStart: String(offsetStart),
      offsetEnd: String(offsetEnd),
    });
    const res = await this.transport.requestDataWithRetry<JsonObject>(
      "GET",
      `/area/v3/members?${params}`,
      { retryOn429: true, maxAttempts: 3 }
    );

    const members = (res["members"] || []) as JsonObject[];
    const page: AreaMembersPage = {
      members: members.map((m) => ({
        uid: (m["uid"] || "") as string,
        nickname: m["nickname"] as string | undefined,
        avatar: m["avatar"] as string | undefined,
        roleId: m["roleId"] as string | undefined,
        joinedAt: m["joinedAt"] as string | undefined,
      })),
      total: (res["totalCount"] || 0) as number,
      offset: options?.offset,
      limit: options?.limit,
    };

    // 写缓存
    this.cache.setAreaMembersPage(areaId, offsetStart, offsetEnd, page);

    return page;
  }

  /** 获取用户在区域内的详细信息。 */
  async getUserDetail(
    areaId: string,
    uid: string,
  ): Promise<AreaUserDetail | null> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      const params = new URLSearchParams({ area: areaId, target: uid });
      const result = await this.transport.get<JsonObject>(
        `/area/v3/userDetail?${params}`,
      );
      const data = (result["data"] || result) as JsonObject;
      return {
        uid: (data["uid"] || uid) as string,
        nickname: (data["nickname"] || "") as string,
        avatar: data["avatar"] as string | undefined,
        roles: (data["list"] || data["roles"] || []) as RoleInfo[],
        joinedAt: data["joinedAt"] as string | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * 获取域内可授予的角色列表（对齐 Python get_area_can_give_list）。
   */
  async getAreaCanGiveList(
    areaId: string,
    target: string,
  ): Promise<AreaRoleInfo[]> {
    this.requireParam(areaId, "areaId");
    this.requireParam(target, "target");

    const params = new URLSearchParams({ area: areaId, target });
    const result = await this.transport.get<JsonObject>(
      `/area/v3/role/canGiveList?${params}`,
    );
    const data = (result["data"] || result) as JsonObject;
    const list = Array.isArray(data) ? data : (data["list"] || []) as JsonObject[];
    return list as AreaRoleInfo[];
  }
}
