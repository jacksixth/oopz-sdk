import { BaseService } from "./base";
import type { OperationResult } from "../models/base";
import { success, failure } from "../models/base";
import type { TextMuteInterval, VoiceMuteInterval } from "../models";

/**
 * 运营管理服务 — 踢出、封禁、禁言操作。
 */
export class Moderation extends BaseService {
  /** 将成员从区域中踢出。 */
  async kick(areaId: string, uid: string, reason?: string): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      await this.transport.post("/api/moderation/kick", { areaId, uid, reason });
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /** 封禁区域内成员。 */
  async ban(
    areaId: string,
    uid: string,
    durationSeconds?: number,
    reason?: string
  ): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      await this.transport.post("/api/moderation/ban", {
        areaId,
        uid,
        durationSeconds,
        reason,
      });
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /** 解除成员封禁。 */
  async unban(areaId: string, uid: string): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      await this.transport.post("/api/moderation/unban", { areaId, uid });
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /** 禁言用户在区域内的文字消息。 */
  async muteText(interval: TextMuteInterval): Promise<OperationResult> {
    this.requireParam(interval.areaId, "areaId");
    this.requireParam(interval.uid, "uid");

    try {
      await this.transport.post("/api/moderation/mute/text", interval);
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /** 取消用户文字消息禁言。 */
  async unmuteText(areaId: string, uid: string): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(uid, "uid");

    try {
      await this.transport.post("/api/moderation/unmute/text", { areaId, uid });
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /** 禁言用户在频道内的语音。 */
  async muteVoice(interval: VoiceMuteInterval): Promise<OperationResult> {
    this.requireParam(interval.areaId, "areaId");
    this.requireParam(interval.channelId, "channelId");
    this.requireParam(interval.uid, "uid");

    try {
      await this.transport.post("/api/moderation/mute/voice", interval);
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }

  /** 取消用户语音禁言。 */
  async unmuteVoice(
    areaId: string,
    channelId: string,
    uid: string
  ): Promise<OperationResult> {
    this.requireParam(areaId, "areaId");
    this.requireParam(channelId, "channelId");
    this.requireParam(uid, "uid");

    try {
      await this.transport.post("/api/moderation/unmute/voice", { areaId, channelId, uid });
      return success();
    } catch (err) {
      return failure(String(err));
    }
  }
}
