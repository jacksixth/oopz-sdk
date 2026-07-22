import { BaseService } from "./base";
import type { OperationResult } from "../models/base";
import { success, failure } from "../models/base";

/**
 * 文字禁言时长映射（对齐 Python TextMuteInterval）。
 * 将 durationSeconds 映射到 Oopz API 的 intervalId。
 */
const TEXT_MUTE_INTERVALS: { maxSeconds: number; intervalId: number }[] = [
  { maxSeconds: 60, intervalId: 1 },
  { maxSeconds: 300, intervalId: 2 },
  { maxSeconds: 3600, intervalId: 3 },
  { maxSeconds: 86400, intervalId: 4 },
  { maxSeconds: 259200, intervalId: 5 },
  { maxSeconds: 604800, intervalId: 6 },
];

/**
 * 语音禁言时长映射（对齐 Python VoiceMuteInterval）。
 */
const VOICE_MUTE_INTERVALS: { maxSeconds: number; intervalId: number }[] = [
  { maxSeconds: 60, intervalId: 7 },
  { maxSeconds: 300, intervalId: 8 },
  { maxSeconds: 3600, intervalId: 9 },
  { maxSeconds: 86400, intervalId: 10 },
  { maxSeconds: 259200, intervalId: 11 },
  { maxSeconds: 604800, intervalId: 12 },
];

function pickTextIntervalId(durationSeconds: number): number {
  for (const item of TEXT_MUTE_INTERVALS) {
    if (durationSeconds <= item.maxSeconds) return item.intervalId;
  }
  return TEXT_MUTE_INTERVALS[TEXT_MUTE_INTERVALS.length - 1].intervalId;
}

function pickVoiceIntervalId(durationSeconds: number): number {
  for (const item of VOICE_MUTE_INTERVALS) {
    if (durationSeconds <= item.maxSeconds) return item.intervalId;
  }
  return VOICE_MUTE_INTERVALS[VOICE_MUTE_INTERVALS.length - 1].intervalId;
}

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
      return failure(String(err));
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
      return failure(String(err));
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
      return failure(String(err));
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
      const intervalId = pickTextIntervalId(durationSeconds);
      const params = new URLSearchParams({
        area: areaId,
        target: uid,
        intervalId: String(intervalId),
      });
      await this.transport.patch(
        `/client/v1/area/v1/member/v1/disableText?${params}`
      );
      return success();
    } catch (err) {
      return failure(String(err));
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
      return failure(String(err));
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
      const intervalId = pickVoiceIntervalId(durationSeconds);
      const params = new URLSearchParams({
        area: areaId,
        target: uid,
        intervalId: String(intervalId),
      });
      await this.transport.patch(
        `/client/v1/area/v1/member/v1/disableVoice?${params}`
      );
      return success();
    } catch (err) {
      return failure(String(err));
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
      return failure(String(err));
    }
  }
}
