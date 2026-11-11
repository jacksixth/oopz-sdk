import { BaseService } from "./base";
import type {
  UserInfo,
  Profile,
  Friendship,
  FriendshipRequest,
  UserRemarkNamesResponse,
  UserLevelInfo,
} from "../models";
import type { OperationResult } from "../models/base";
import { success, failure } from "../models/base";
import type { JsonObject } from "../models/base";
import { coerceBool } from "../utils/payload";

/**
 * 人员服务 — 用户资料、好友关系。
 * API 路径对齐 Python SDK (tangqingfeng7/Oopzbot-SDK)
 */
export class Person extends BaseService {
  /**
   * 批量获取用户信息（对齐 Python get_person_infos_batch）。
   *
   * 按批（每批 30 个）请求，并写入用户信息缓存。
   */
  async getUserInfos(uids: string[]): Promise<Record<string, UserInfo>> {
    if (!uids.length) return {};

    const result: Record<string, UserInfo> = {};
    const missing: string[] = [];

    // 先读缓存
    for (const uid of uids) {
      const cached = this.cache.getUserinfo(uid);
      if (cached) {
        result[uid] = cached;
      } else {
        missing.push(uid);
      }
    }

    // 分批请求（对齐 Python 的 batch_size = 30）
    const BATCH_SIZE = 30;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      try {
        const response = await this.transport.post<JsonObject>(
          "/client/v1/person/v1/personInfos",
          { persons: batch, commonIds: [] }
        );
        const list = (Array.isArray(response) ? response : response["data"] || []) as JsonObject[];
        for (const item of list) {
          const uid = (item["uid"] || "") as string;
          if (!uid) continue;
          const user: UserInfo = {
            uid,
            nickname: (item["name"] || item["nickname"] || "") as string,
            avatar: item["avatar"] as string | undefined,
            bio: (item["bio"] || item["introduction"] || "") as string,
            level: (item["level"] || item["memberLevel"]) as number | undefined,
          };
          result[uid] = user;
          this.cache.setUserinfo(uid, user);
        }
      } catch (err) {
        // 单批失败不影响其它批次
        if (missing.length === batch.length) throw err;
      }
    }

    return result;
  }

  /** 通过 UID 获取用户信息。 */
  async getUserInfo(uid: string): Promise<UserInfo | null> {
    this.requireParam(uid, "uid");
    const map = await this.getUserInfos([uid]);
    return map[uid] || null;
  }

  /**
   * 获取他人完整详细资料（对齐 Python get_person_detail_full）。
   */
  async getPersonDetail(uid: string): Promise<Profile | null> {
    this.requireParam(uid, "uid");

    const cached = this.cache.getPersonProfile(uid);
    if (cached) return cached;

    try {
      const result = await this.transport.get<JsonObject>(
        `/client/v1/person/v1/personDetail?uid=${encodeURIComponent(uid)}`
      );
      const data = (result["data"] || result) as JsonObject;
      const profile: Profile = {
        uid: (data["uid"] || uid) as string,
        nickname: (data["nickname"] || data["name"] || "") as string,
        avatar: data["avatar"] as string | undefined,
        bio: (data["bio"] || data["introduction"] || "") as string,
        gender: data["gender"] as number | undefined,
        birthday: data["birthday"] as string | undefined,
        level: (data["level"] || data["memberLevel"]) as number | undefined,
      };
      this.cache.setPersonProfile(uid, profile);
      return profile;
    } catch {
      return null;
    }
  }

  /** 获取机器人自己的资料（对齐 Python get_self_detail）。 */
  async getMyProfile(): Promise<Profile | null> {
    try {
      const cached = this.cache.getIdentity();
      if (cached) return cached;

      const uid = this.config.personUid;
      const params = new URLSearchParams({ uid });
      const result = await this.transport.get<JsonObject>(
        `/client/v1/person/v2/selfDetail?${params}`
      );
      const data = (result["data"] || result) as JsonObject;
      const profile: Profile = {
        uid: (data["uid"] || uid) as string,
        nickname: (data["nickname"] || "") as string,
        avatar: data["avatar"] as string | undefined,
        bio: data["bio"] as string | undefined,
        gender: data["gender"] as number | undefined,
        birthday: data["birthday"] as string | undefined,
        level: (data["level"] || data["memberLevel"]) as number | undefined,
      };
      this.cache.setIdentity(profile);
      return profile;
    } catch {
      return null;
    }
  }

  /**
   * 获取当前用户等级、积分信息（对齐 Python get_level_info）。
   */
  async getLevelInfo(): Promise<UserLevelInfo | null> {
    try {
      const result = await this.transport.get<JsonObject>("/user_points/v1/level_info");
      const data = (result["data"] || result) as JsonObject;
      return {
        authDesc: (data["authDesc"] || "") as string,
        authState: (data["authState"] || 0) as number,
        currentLevel: (data["currentLevel"] || 0) as number,
        currentLevelFullPoints: (data["currentLevelFullPoints"] || 0) as number,
        hasNotReceivePrize: coerceBool(data["hasNotReceivePrize"], false),
        nextLevel: (data["nextLevel"] || 0) as number,
        nextLevelDistance: (data["nextLevelDistance"] || 0) as number,
        payPoints: (data["payPoints"] || 0) as number,
        signInPoints: (data["signInPoints"] || 0) as number,
      };
    } catch {
      return null;
    }
  }

  /** 获取好友列表。 */
  async getFriends(): Promise<Friendship[]> {
    try {
      const result = await this.transport.get<JsonObject>("/client/v1/list/v1/friendship");
      const list = (Array.isArray(result) ? result : result["data"] || []) as JsonObject[];
      return list.map((f) => ({
        uid: (f["uid"] || f["person"] || "") as string,
        nickname: (f["nickname"] || "") as string,
        avatar: f["avatar"] as string | undefined,
        remark: f["remark"] as string | undefined,
        isOnline: coerceBool(f["isOnline"], false),
      }));
    } catch {
      return [];
    }
  }

  /** 获取待处理好友请求。 */
  async getFriendRequests(): Promise<FriendshipRequest[]> {
    try {
      const result = await this.transport.get<JsonObject>("/client/v1/friendship/v1/requests");
      const data = (result["data"] || result) as JsonObject;
      const requests = (data["requests"] || []) as JsonObject[];
      return requests.map((r) => ({
        requestId: (r["requestId"] || r["friendRequestId"] || r["id"] || "") as string,
        fromUid: (r["fromUid"] || r["person"] || "") as string,
        fromNickname: (r["fromNickname"] || "") as string,
        fromAvatar: r["fromAvatar"] as string | undefined,
        message: r["message"] as string | undefined,
        timestamp: (r["timestamp"] || "") as string,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 接受或拒绝好友请求（对齐 Python post_friendship_response）。
   *
   * 请求列表通过 {@link getFriendRequests} 获取。
   */
  async acceptFriendRequest(requestId: string, agree: boolean = true): Promise<OperationResult> {
    this.requireParam(requestId, "requestId");
    try {
      await this.transport.post("/client/v1/friendship/v1/response", {
        agree,
        friendRequestId: Number(requestId),
        target: "",
      });
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /** 设置备注名（对齐 Python set_user_remark_name）。 */
  async setRemark(uid: string, remark: string): Promise<OperationResult> {
    this.requireParam(uid, "uid");
    try {
      await this.transport.post("/person/v1/remarkName/setUserRemarkName", {
        remarkUid: uid,
        remarkName: remark,
      });
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /** 获取备注名（对齐 Python get_person_remark_name）。 */
  async getRemarks(uid?: string): Promise<UserRemarkNamesResponse | null> {
    try {
      const targetUid = uid || this.config.personUid;
      const params = new URLSearchParams({ uid: targetUid });
      const result = await this.transport.get<JsonObject>(
        `/person/v1/remarkName/getUserRemarkNames?${params}`
      );
      const data = (result["data"] || result) as JsonObject;
      return {
        remarks: (data["remarks"] || {}) as Record<string, string>,
      };
    } catch {
      return null;
    }
  }
}

/** 提取错误信息文本（优先 err.message）。 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
