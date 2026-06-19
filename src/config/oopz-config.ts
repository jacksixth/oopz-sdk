import {
  OopzConfigOptions,
  RequestConfig,
  RetryConfig,
  HeartbeatConfig,
  ProxyConfig,
} from "./settings";
import { OopzAuthError } from "../exceptions";

/** 各配置项的默认值（对齐 Python SDK）。 */
export const DEFAULT_BASE_URL = "https://gateway.oopz.cn";
export const DEFAULT_WS_URL = "wss://ws.oopz.cn";
export const DEFAULT_APP_VERSION = "69514";
export const DEFAULT_PLATFORM = "windows";
export const DEFAULT_CHANNEL = "Web";
export const DEFAULT_AGORA_APP_ID = "b9a2b7b2b7b2b7b2b7b2b7b2b7b2b7b2";

export const DEFAULT_RETRY: Required<RetryConfig> = {
  maxAttempts: 3,
};

export const DEFAULT_HEARTBEAT: Required<HeartbeatConfig> = {
  interval: 10,
  reconnectInterval: 2,
  maxReconnectInterval: 120,
};

export const DEFAULT_REQUEST_TIMEOUT: [number, number] = [10, 30];

/**
 * Oopz SDK 主配置对象。
 * 对应 Python 版本的 `OopzConfig` 类。
 */
export class OopzConfig {
  // 凭据
  deviceId: string;
  personUid: string;
  jwtToken: string;
  privateKey: string;

  // 端点
  baseUrl: string;
  wsUrl: string;

  // 应用标识
  appVersion: string;
  platform: string;
  channel: string;
  web: boolean;

  // 公告
  useAnnouncementStyle: boolean;

  // 缓存
  userinfoCacheMaxEntries: number;
  userinfoCacheTtl: number;
  areaChannelsCacheMaxEntries: number;
  areaChannelsCacheTtl: number;
  personProfilesCacheMaxEntries: number;
  personProfileCacheTtl: number;
  areaUserNicknameCacheMaxEntries: number;
  areaUserNicknameCacheTtl: number;
  areaMembersPageCacheMaxEntries: number;
  areaMembersPageCacheTtl: number;

  // 请求
  requestTimeout: number | [number, number];
  rateLimitInterval: number;

  // Agora
  agoraAppId: string;

  // 机器人行为
  ignoreSelfMessages: boolean;
  autoSubscribeJoinedAreas: boolean;

  // 子配置
  request: RequestConfig;
  retry: Required<RetryConfig>;
  rateLimit: OopzConfigOptions["rateLimit"];
  heartbeat: Required<HeartbeatConfig>;
  proxy: ProxyConfig;

  constructor(options: OopzConfigOptions = {}) {
    this.deviceId = options.deviceId ?? "";
    this.personUid = options.personUid ?? "";
    this.jwtToken = options.jwtToken ?? "";
    this.privateKey = options.privateKey ?? "";

    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.wsUrl = options.wsUrl ?? DEFAULT_WS_URL;

    this.appVersion = options.appVersion ?? DEFAULT_APP_VERSION;
    this.platform = options.platform ?? DEFAULT_PLATFORM;
    this.channel = options.channel ?? DEFAULT_CHANNEL;
    this.web = options.web ?? true;

    this.useAnnouncementStyle = options.useAnnouncementStyle ?? false;

    this.userinfoCacheMaxEntries = options.userinfoCacheMaxEntries ?? 5000;
    this.userinfoCacheTtl = options.userinfoCacheTtl ?? 1800;
    this.areaChannelsCacheMaxEntries = options.areaChannelsCacheMaxEntries ?? 1000;
    this.areaChannelsCacheTtl = options.areaChannelsCacheTtl ?? 1800;
    this.personProfilesCacheMaxEntries = options.personProfilesCacheMaxEntries ?? 3000;
    this.personProfileCacheTtl = options.personProfileCacheTtl ?? 1800;
    this.areaUserNicknameCacheMaxEntries = options.areaUserNicknameCacheMaxEntries ?? 20000;
    this.areaUserNicknameCacheTtl = options.areaUserNicknameCacheTtl ?? 300;
    this.areaMembersPageCacheMaxEntries = options.areaMembersPageCacheMaxEntries ?? 200;
    this.areaMembersPageCacheTtl = options.areaMembersPageCacheTtl ?? 10;

    this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
    this.rateLimitInterval = options.rateLimitInterval ?? 0;

    this.agoraAppId = options.agoraAppId ?? DEFAULT_AGORA_APP_ID;

    this.ignoreSelfMessages = options.ignoreSelfMessages ?? true;
    this.autoSubscribeJoinedAreas = options.autoSubscribeJoinedAreas ?? true;

    this.request = options.request ?? {};
    this.retry = { ...DEFAULT_RETRY, ...options.retry };
    this.rateLimit = options.rateLimit;
    this.heartbeat = { ...DEFAULT_HEARTBEAT, ...options.heartbeat };
    this.proxy = options.proxy ?? {};
  }

  /** 检查是否所有必需的凭据都已提供。 */
  hasCredentials(): boolean {
    return !!(this.deviceId && this.personUid && this.jwtToken);
  }

  /** 如果凭据缺失则抛出异常。 */
  ensureCredentials(): void {
    if (!this.hasCredentials()) {
      throw new OopzAuthError(
        "凭据缺失：需要 deviceId、personUid 和 jwtToken。"
      );
    }
  }

  /** 从环境变量构建配置。 */
  static fromEnv(prefix: string = "OOPZ_", overrides: OopzConfigOptions = {}): OopzConfig {
    const env = process.env;
    const options: OopzConfigOptions = {
      deviceId: env[`${prefix}DEVICE_ID`] ?? undefined,
      personUid: env[`${prefix}PERSON_UID`] ?? undefined,
      jwtToken: env[`${prefix}JWT_TOKEN`] ?? undefined,
      privateKey: env[`${prefix}PRIVATE_KEY`] ?? undefined,
      baseUrl: env[`${prefix}BASE_URL`] ?? undefined,
      wsUrl: env[`${prefix}WS_URL`] ?? undefined,
      ...overrides,
    };
    return new OopzConfig(options);
  }

  /** 生成 API 请求的标准 HTTP 头。 */
  getHeaders(): Record<string, string> {
    return {
      "x-oopz-device-id": this.deviceId,
      "x-oopz-person-uid": this.personUid,
      "x-oopz-app-version": this.appVersion,
      "x-oopz-platform": this.platform,
    };
  }
}
