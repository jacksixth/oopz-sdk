/**
 * ID 生成器（对齐 Python SDK `oopz_sdk.auth.ids`）。
 */

import * as crypto from "crypto";

/** 客户端消息 ID 生成器。 */
export class ClientMessageIdGenerator {
  generate(): string {
    const timestampUs = Math.floor(Date.now() * 1000);
    const baseId = timestampUs % 10_000_000_000_000;
    const suffix = Math.floor(Math.random() * 90) + 10; // 10-99
    return String(baseId * 100 + suffix);
  }
}

/** 生成 UUID v4 格式的请求 ID。 */
export function requestId(): string {
  return crypto.randomUUID();
}

/** 生成毫秒级时间戳字符串。 */
export function timestampMs(): string {
  return String(Math.floor(Date.now()));
}

/** 生成微秒级时间戳字符串。 */
export function timestampUs(): string {
  return String(Math.floor(Date.now() * 1000));
}
