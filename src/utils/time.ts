/**
 * 时间工具（对齐 Python SDK）。
 */

/** 格式化时间戳为可读字符串。 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString();
}

/** 获取当前毫秒级时间戳。 */
export function nowMs(): number {
  return Date.now();
}

/** 获取当前秒级时间戳。 */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
