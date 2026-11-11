const SDK_LOGGER_NAME = "oopz_sdk";

/** 支持的日志级别。 */
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

let _debugEnabled = false;

/** 设置 SDK 全局调试模式。 */
export function setSdkDebug(enabled: boolean): void {
  _debugEnabled = enabled;
}

/** 当前是否处于调试模式。 */
export function isSdkDebug(): boolean {
  return _debugEnabled;
}

/** 仅在 debug 模式下输出的日志。用法同 console.log。 */
export function sdkLog(...args: unknown[]): void {
  if (_debugEnabled) {
    console.log(...args);
  }
}

/**
 * 设置 SDK 日志级别。
 *
 * - `"DEBUG"`：打开调试日志（等价于 `setSdkDebug(true)`）
 * - 其它级别：关闭调试日志
 *
 * 也可以直接用 `new OopzConfig({ debug: true })` 打开调试日志。
 */
export function setupLogging(level: string = "INFO"): void {
  setSdkDebug(String(level).toUpperCase() === "DEBUG");
}

export { SDK_LOGGER_NAME };
