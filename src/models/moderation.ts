/** 文字或语音禁言的时间间隔。 */
export interface TextMuteInterval {
  uid: string;
  areaId: string;
  durationSeconds: number;
  reason?: string;
}

export interface VoiceMuteInterval {
  uid: string;
  areaId: string;
  channelId: string;
  durationSeconds: number;
  reason?: string;
}
