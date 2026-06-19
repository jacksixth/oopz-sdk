const SDK_LOGGER_NAME = "oopz_sdk";

function setupLogging(level: string = "INFO"): void {
  // 简单的基于控制台的日志设置；用户可以替换为自己的 logger。
  // 如需高级用法，可集成 pino、winston 等。
}

export { SDK_LOGGER_NAME, setupLogging };
