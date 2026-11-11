import { setSdkDebug } from "../logger";
import {
  OopzConfigOptions,
  RequestConfig,
  RetryConfig,
  HeartbeatConfig,
  ProxyConfig,
  RateLimitConfig,
} from "./settings";
import { OopzAuthError } from "../exceptions";

/** 各配置项的默认值（对齐 Python SDK）。 */
export const DEFAULT_BASE_URL = "https://gateway.oopz.cn";
export const DEFAULT_WS_URL = "wss://ws.oopz.cn";
export const DEFAULT_APP_VERSION = "69514";
export const DEFAULT_PLATFORM = "windows";
export const DEFAULT_CHANNEL = "Web";
export const DEFAULT_AGORA_APP_ID = "358eebceadb94c2a9fd91ecd7b341602";

export const DEFAULT_RETRY: Required<RetryConfig> = {
  maxAttempts: 3,
};

export const DEFAULT_HEARTBEAT: Required<HeartbeatConfig> = {
  interval: 10,
  reconnectInterval: 2,
  maxReconnectInterval: 120,
};

/**
 * 默认请求超时（毫秒）：[连接超时, 读取超时]。
 * 对齐 Python SDK 的 `DEFAULT_REQUEST_TIMEOUT`。
 */
export const DEFAULT_REQUEST_TIMEOUT: [number, number] = [10_000, 30_000];

export const DEFAULT_RATE_LIMIT: Required<RateLimitConfig> = {
  interval: 0,
};

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

  // Agora
  agoraAppId: string;

  // 机器人行为
  ignoreSelfMessages: boolean;
  autoSubscribeJoinedAreas: boolean;

  // 调试
  debug: boolean;

  // 子配置
  request: Required<RequestConfig>;
  retry: Required<RetryConfig>;
  rateLimit: Required<RateLimitConfig>;
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

    this.agoraAppId = options.agoraAppId ?? DEFAULT_AGORA_APP_ID;

    this.ignoreSelfMessages = options.ignoreSelfMessages ?? true;
    this.autoSubscribeJoinedAreas = options.autoSubscribeJoinedAreas ?? false;

    this.debug = options.debug ?? false;
    setSdkDebug(this.debug);

    // `request.timeout` / `rateLimit.interval` 是唯一事实来源；
    // 顶层的 `requestTimeout` / `rateLimitInterval` 只是它的别名（见下方 getter/setter）。
    this.request = {
      timeout: options.request?.timeout ?? options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT,
    };
    this.retry = { ...DEFAULT_RETRY, ...options.retry };
    this.rateLimit = {
      interval: options.rateLimit?.interval ?? options.rateLimitInterval ?? DEFAULT_RATE_LIMIT.interval,
    };
    this.heartbeat = { ...DEFAULT_HEARTBEAT, ...options.heartbeat };
    this.proxy = options.proxy ?? {};
  }

  /**
   * 请求超时（毫秒）。
   *
   * 单一值表示总超时；`[连接超时, 读取超时]` 表示分段超时。
   * 与 `config.request.timeout` 是同一个值（对齐 Python 的 `request_timeout` property）。
   */
  get requestTimeout(): number | [number, number] {
    return this.request.timeout;
  }

  set requestTimeout(value: number | [number, number]) {
    this.request.timeout = value;
  }

  /**
   * 请求间隔限流（秒）。
   * 与 `config.rateLimit.interval` 是同一个值（对齐 Python 的 `rate_limit_interval` property）。
   */
  get rateLimitInterval(): number {
    return this.rateLimit.interval;
  }

  set rateLimitInterval(value: number) {
    this.rateLimit.interval = value;
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
      appVersion: env[`${prefix}APP_VERSION`] ?? undefined,
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
