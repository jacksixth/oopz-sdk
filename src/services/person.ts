import { BaseService } from "./base";
import type {
  UserInfo,
  Profile,
  Friendship,
  FriendshipRequest,
  UserRemarkNamesResponse,
} from "../models";
import type { OperationResult } from "../models/base";
import { success, failure } from "../models/base";
import type { JsonObject } from "../models/base";

/**
 * 人员服务 — 用户资料、好友关系。
 * API 路径对齐 Python SDK (tangqingfeng7/Oopzbot-SDK)
 */
export class Person extends BaseService {
  /** 通过 UID 获取用户信息。 */
  async getUserInfo(uid: string): Promise<UserInfo | null> {
    this.requireParam(uid, "uid");
    const map = await this.getUserInfos([uid]);
    return map[uid] || null;
  }

  /** 批量获取用户信息（对齐 Python get_person_infos）。返回 uid → UserInfo 映射。 */
  async getUserInfos(uids: string[]): Promise<Record<string, UserInfo>> {
    if (!uids.length) return {};
    try {
      const result = await this.transport.post<JsonObject>(
        "/client/v1/person/v1/personInfos",
        { persons: uids, commonIds: [] }
      );
      const list = (Array.isArray(result) ? result : result["data"] || []) as JsonObject[];
      const map: Record<string, UserInfo> = {};
      for (const item of list) {
        const uid = (item["uid"] || "") as string;
        if (!uid) continue;
        map[uid] = {
          uid,
          nickname: (item["name"] || item["nickname"] || "") as string,
          avatar: item["avatar"] as string | undefined,
          bio: (item["bio"] || item["introduction"] || "") as string,
          level: (item["level"] || item["memberLevel"]) as number | undefined,
        };
      }
      return map;
    } catch {
      return {};
    }
  }

  /** 获取机器人自己的资料。 */
  async getMyProfile(): Promise<Profile | null> {
    try {
      const uid = this.config.personUid;
      const params = new URLSearchParams({ uid });
      const result = await this.transport.get<JsonObject>(
        `/client/v1/person/v2/selfDetail?${params}`
      );
      return {
        uid: (result["uid"] || uid) as string,
        nickname: (result["nickname"] || "") as string,
        avatar: result["avatar"] as string | undefined,
        bio: result["bio"] as string | undefined,
        gender: result["gender"] as number | undefined,
        birthday: result["birthday"] as string | undefined,
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
        isOnline: f["isOnline"] as boolean | undefined,
      }));
    } catch {
      return [];
    }
  }

  /** 获取待处理好友请求。 */
  async getFriendRequests(): Promise<FriendshipRequest[]> {
    try {
      const result = await this.transport.get<JsonObject>("/client/v1/friendship/v1/requests");
      const requests = (result["requests"] || result["data"] || []) as JsonObject[];
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

  /** 发送好友请求（暂无 Python SDK 对应路径，保留原路径）。 */
  async sendFriendRequest(uid: string, message?: string): Promise<OperationResult> {
    this.requireParam(uid, "uid");
    try {
      await this.transport.post("/api/user/friend/request", { uid, message });
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /** 接受/拒绝好友请求。 */
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
      return failure(String(err));
    }
  }

  /** 删除好友（暂无 Python SDK 对应路径，保留原路径）。 */
  async removeFriend(uid: string): Promise<OperationResult> {
    this.requireParam(uid, "uid");
    try {
      await this.transport.post("/api/user/friend/remove", { uid });
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /** 设置备注名。 */
  async setRemark(uid: string, remark: string): Promise<OperationResult> {
    this.requireParam(uid, "uid");
    try {
      await this.transport.post("/person/v1/remarkName/setUserRemarkName", {
        remarkUid: uid,
        remarkName: remark,
      });
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /** 获取备注名。 */
  async getRemarks(): Promise<UserRemarkNamesResponse | null> {
    try {
      const result = await this.transport.get<JsonObject>("/person/v1/remarkName/getUserRemarkNames");
      return {
        remarks: (result["remarks"] || result || {}) as Record<string, string>,
      };
    } catch {
      return null;
    }
  }
}
