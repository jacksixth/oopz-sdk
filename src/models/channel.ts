/** 频道类型枚举。 */
export enum ChannelType {
  TEXT = 0,
  VOICE = 1,
  CATEGORY = 2,
}

export interface ChannelSetting {
  channelId: string;
  areaId: string;
  name: string;
  type: ChannelType;
  groupId?: string;
  position?: number;
  topic?: string;
  isPrivate?: boolean;
}

export interface CreateChannelResult {
  channelId: string;
  name: string;
  type: ChannelType;
}

export interface ChannelEdit {
  name?: string;
  topic?: string;
  position?: number;
  groupId?: string;
  isPrivate?: boolean;
}

/**
 * 进入语音频道后服务端返回的签名信息（对齐 Python ChannelSign）。
 */
export interface ChannelSign {
  /** Agora 供应商签名（作为 rtcToken 使用）。 */
  rtcToken: string;
  /** Agora 房间名。 */
  rtcChannelName: string;
  /** 房间 ID。 */
  roomId: string;
  /** 供应商签名。 */
  supplierSign: string;
  /** Agora App ID。 */
  appId: number;
  /** 用户签名。 */
  userSign: string;
  /** 供应商标识。 */
  supplier: string;
  /** 签名有效期（秒）。 */
  expireSeconds: number;
}

/**
 * 语音频道内的成员信息（对齐 Python VoiceChannelMemberInfo）。
 */
export interface VoiceChannelMemberInfo {
  uid: string;
  botType: string;
  dimensions: string;
  enterTime: string;
  framerate: string;
  isBot: boolean;
  peopleLimit: number;
  screenSharingState: string;
  screenType: string;
  sort: number;
}

/**
 * 各语音频道的在线成员结果（对齐 Python VoiceChannelMembersResult）。
 * key = channelId, value = 成员列表。
 */
export interface VoiceChannelMembersResult {
  channelMembers: Record<string, VoiceChannelMemberInfo[]>;
}
