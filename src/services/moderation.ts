import { BaseService } from "./base";
import type { OperationResult } from "../models/base";
import { success, failure } from "../models/base";
import { TextMuteInterval, VoiceMuteInterval } from "../models/moderation";
import type { JsonObject } from "../models/base";

/**
 * 运营管理服务 — 踢出、封禁、禁言操作。
 * API 路径对齐 Python SDK (tangqingfeng7/Oopzbot-SDK)
 */
export class Moderation extends BaseService {
  /**
   * 将成员从区域中移除（对齐 Python remove_from_area）。
   * POST /area/v3/remove
   */
  async kick(areaId: string, uid: string, _reason?: string): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      await this.transport.post("/area/v3/remove", { area: areaId, target: uid });
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 封禁区域内成员（对齐 Python block_user_in_area）。
   * DELETE /client/v1/area/v1/block
   */
  async ban(
    areaId: string,
    uid: string,
    _durationSeconds?: number,
    _reason?: string
  ): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      const params = new URLSearchParams({ area: areaId, target: uid });
      await this.transport.del(`/client/v1/area/v1/block?${params}`);
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 获取域内封禁名单（对齐 Python get_area_blocks）。
   */
  async getAreaBlocks(areaId: string, name: string = ""): Promise<JsonObject[]> {
    this.requireParam(areaId, "areaId");

    try {
      const params = new URLSearchParams({ area: areaId, name });
      const result = await this.transport.get<JsonObject>(
        `/client/v1/area/v1/areaSettings/v1/blocks?${params}`
      );
      const list = (Array.isArray(result) ? result : result["data"] || []) as JsonObject[];
      return list;
    } catch {
      return [];
    }
  }

  /**
   * 解除成员封禁（对齐 Python unblock_user_in_area）。
   * PATCH /client/v1/area/v1/unblock
   */
  async unban(areaId: string, uid: string): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      const params = new URLSearchParams({ area: areaId, target: uid });
      await this.transport.patch(`/client/v1/area/v1/unblock?${params}`);
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 禁言用户在区域内的文字消息（对齐 Python mute_user）。
   * PATCH /client/v1/area/v1/member/v1/disableText
   * @param durationSeconds 禁言时长（秒），默认 300（5 分钟）
   */
  async muteText(
    areaId: string,
    uid: string,
    durationSeconds: number = 300
  ): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      const params = new URLSearchParams({
        area: areaId,
        target: uid,
        intervalId: String(TextMuteInterval.pick(durationSeconds)),
      });
      await this.transport.patch(
        `/client/v1/area/v1/member/v1/disableText?${params}`
      );
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 取消用户文字消息禁言（对齐 Python unmute_user）。
   * PATCH /client/v1/area/v1/member/v1/recoverText
   */
  async unmuteText(areaId: string, uid: string): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      const params = new URLSearchParams({ area: areaId, target: uid });
      await this.transport.patch(
        `/client/v1/area/v1/member/v1/recoverText?${params}`
      );
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 禁言用户在区域内的语音（对齐 Python mute_mic）。
   * PATCH /client/v1/area/v1/member/v1/disableVoice
   * @param durationSeconds 禁言时长（秒），默认 300（5 分钟）
   */
  async muteVoice(
    areaId: string,
    uid: string,
    durationSeconds: number = 300
  ): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      const params = new URLSearchParams({
        area: areaId,
        target: uid,
        intervalId: String(VoiceMuteInterval.pick(durationSeconds)),
      });
      await this.transport.patch(
        `/client/v1/area/v1/member/v1/disableVoice?${params}`
      );
      return success();
    } catch (err) {
      return failure(errorMessage(err));
    }
  }

  /**
   * 取消用户语音禁言（对齐 Python unmute_mic）。
   * PATCH /client/v1/area/v1/member/v1/recoverVoice
   */
  async unmuteVoice(areaId: string, uid: string): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      const params = new URLSearchParams({ area: areaId, target: uid });
      await this.transport.patch(
        `/client/v1/area/v1/member/v1/recoverVoice?${params}`
      );
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
