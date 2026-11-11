/**
 * 文字禁言时长枚举（对齐 Python TextMuteInterval）。
 *
 * 每个档位对应 Oopz API 的 `intervalId`。
 * 档位边界以「分钟」定义（对齐 Python SDK），`pick()` 接受秒数。
 */
export enum TextMuteInterval {
  /** 60 秒 */
  S60 = 1,
  /** 5 分钟 */
  M5 = 2,
  /** 1 小时 */
  H1 = 3,
  /** 1 天 */
  D1 = 4,
  /** 3 天 */
  D3 = 5,
  /** 7 天 */
  D7 = 6,
}

/**
 * 语音禁言时长枚举（对齐 Python VoiceMuteInterval）。
 */
export enum VoiceMuteInterval {
  /** 60 秒 */
  S60 = 7,
  /** 5 分钟 */
  M5 = 8,
  /** 1 小时 */
  H1 = 9,
  /** 1 天 */
  D1 = 10,
  /** 3 天 */
  D3 = 11,
  /** 7 天 */
  D7 = 12,
}

/** 各档位的分钟数（对齐 Python SDK 的 minutes 字段）。 */
const TEXT_MUTE_MINUTES: [number, TextMuteInterval][] = [
  [1, TextMuteInterval.S60],
  [5, TextMuteInterval.M5],
  [60, TextMuteInterval.H1],
  [1440, TextMuteInterval.D1],
  [4320, TextMuteInterval.D3],
  [10080, TextMuteInterval.D7],
];

/** 各档位的分钟数（对齐 Python SDK 的 minutes 字段）。 */
const VOICE_MUTE_MINUTES: [number, VoiceMuteInterval][] = [
  [1, VoiceMuteInterval.S60],
  [5, VoiceMuteInterval.M5],
  [60, VoiceMuteInterval.H1],
  [1440, VoiceMuteInterval.D1],
  [4320, VoiceMuteInterval.D3],
  [10080, VoiceMuteInterval.D7],
];

/**
 * 按秒数选择最接近的禁言档位（对齐 Python TextMuteInterval.pick）。
 *
 * @param durationSeconds 禁言时长（秒）
 */
export namespace TextMuteInterval {
  export function pick(durationSeconds: number): TextMuteInterval {
    const minutes = durationSeconds / 60;
    for (const [upperMinutes, interval] of TEXT_MUTE_MINUTES) {
      if (minutes <= upperMinutes) return interval;
    }
    return TextMuteInterval.D7;
  }

  /** 该档位对应的时长上限（秒）。 */
  export function seconds(interval: TextMuteInterval): number {
    for (const [minutes, value] of TEXT_MUTE_MINUTES) {
      if (value === interval) return minutes * 60;
    }
    return 10080 * 60;
  }
}

/**
 * 按秒数选择最接近的语音禁言档位（对齐 Python VoiceMuteInterval.pick）。
 *
 * @param durationSeconds 禁言时长（秒）
 */
export namespace VoiceMuteInterval {
  export function pick(durationSeconds: number): VoiceMuteInterval {
    const minutes = durationSeconds / 60;
    for (const [upperMinutes, interval] of VOICE_MUTE_MINUTES) {
      if (minutes <= upperMinutes) return interval;
    }
    return VoiceMuteInterval.D7;
  }

  /** 该档位对应的时长上限（秒）。 */
  export function seconds(interval: VoiceMuteInterval): number {
    for (const [minutes, value] of VOICE_MUTE_MINUTES) {
      if (value === interval) return minutes * 60;
    }
    return 10080 * 60;
  }
}
