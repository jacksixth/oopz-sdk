/**
 * SDK 版本号。
 *
 * 从 package.json 读取，保证与实际发布的版本永远一致
 * （避免手工维护两份版本号导致漂移）。
 */
function readVersion(): string {
  try {
    // 编译产物位于 dist/version.js，package.json 位于其上一级
    const pkg = require("../package.json");
    if (pkg && typeof pkg.version === "string") {
      return pkg.version;
    }
  } catch {
    // 打包环境或路径异常时回落到默认值
  }
  return "0.0.0";
}

export const __version__ = readVersion();
