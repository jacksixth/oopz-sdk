import { OopzConfig } from "../config";
import { DEFAULT_HEADERS } from "../config/constants";

/**
 * 根据配置构建 Oopz 专用的 HTTP 请求头。
 *
 * 与 {@link buildOopzApiHeaders} 的区别：这里不包含签名相关的 `Oopz-*` 头，
 * 只包含浏览器模拟头与身份标识头，适用于不需要签名的请求。
 */
export function buildOopzHeaders(
  config: OopzConfig,
  extra?: Record<string, string>
): Record<string, string> {
  const base: Record<string, string> = {
    ...DEFAULT_HEADERS,
    "x-oopz-device-id": config.deviceId,
    "x-oopz-person-uid": config.personUid,
    "x-oopz-app-version": config.appVersion,
    "x-oopz-platform": config.platform,
  };

  if (config.jwtToken) {
    base["Authorization"] = `Bearer ${config.jwtToken}`;
  }

  return { ...base, ...extra };
}
