const SDK_LOGGER_NAME = "oopz_sdk";

let _debugEnabled = false;

/** 设置 SDK 全局调试模式。 */
export function setSdkDebug(enabled: boolean): void {
  _debugEnabled = enabled;
}

/** 仅在 debug 模式下输出的日志。用法同 console.log。 */
export function sdkLog(...args: unknown[]): void {
  if (_debugEnabled) {
    console.log(...args);
  }
}

function setupLogging(level: string = "INFO"): void {
  // 简单的基于控制台的日志设置；用户可以替换为自己的 logger。
  // 如需高级用法，可集成 pino、winston 等。
}

export { SDK_LOGGER_NAME, setupLogging };
