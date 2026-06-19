/**
 * @deprecated 请直接从 "./utils" 目录导入。
 * 为保持向后兼容性保留此文件。
 */

export {
  coerceBool,
  normalizeReactionEmoji,
  stripMarkdown,
  truncateText,
  readImageBytes,
  getImageInfo,
  getImageInfoFromBytes,
  guessImageExt,
  guessImageExtFromBytes,
  formatTimestamp,
  nowMs,
  nowSeconds,
} from "./utils/index";
export type { ImageInput } from "./utils/index";

/** @deprecated 使用 truncateText 替代。 */
export function shortenText(text: string, maxLen: number = 200): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/** @deprecated 使用 auth/ids 中的实现。 */
export function timestampMs(): string {
  return Date.now().toString();
}

/** @deprecated 使用 auth/ids 中的实现。 */
export function timestampUs(): string {
  return String(Math.floor(Date.now() * 1000));
}

/** 安全的 JSON 解析 — 失败时返回 null 而非抛出异常。 */
export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 休眠指定的毫秒数。 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

