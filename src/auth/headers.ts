import { OopzConfig } from "../config";
import { DEFAULT_HEADERS } from "../config/constants";

/**
 * 根据配置构建 Oopz 专用的 HTTP 请求头。
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
