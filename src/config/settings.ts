/** HTTP 请求配置。 */
export interface RequestConfig {
  /**
   * 请求超时（毫秒）。
   *
   * - 单个数字：总超时。
   * - `[连接超时, 读取超时]`：分段超时（对齐 Python SDK 的 `sock_connect` / `sock_read`）。
   */
  timeout?: number | [number, number];
}

/** 重试配置。 */
export interface RetryConfig {
  maxAttempts?: number;
}

/** 请求频率限制配置。 */
export interface RateLimitConfig {
  /** 两次请求之间的最小间隔（秒）。 */
  interval?: number;
}

/** WebSocket 心跳配置。 */
export interface HeartbeatConfig {
  /** 心跳间隔（秒）。 */
  interval?: number;
  /** 首次重连间隔（秒），后续按指数退避增长。 */
  reconnectInterval?: number;
  /** 最大重连间隔（秒）。 */
  maxReconnectInterval?: number;
}

/** 代理配置。 */
export interface ProxyConfig {
  /** HTTP 代理地址。 */
  http?: string | null;
  /** HTTPS 代理地址。 */
  https?: string | null;
  /** WebSocket 代理地址。 */
  websocket?: string | null;
}

export interface OopzConfigOptions {
  /** 设备 ID（凭据）。 */
  deviceId?: string;
  /** 用户 UID（凭据）。 */
  personUid?: string;
  /** JWT 令牌（凭据）。 */
  jwtToken?: string;
  /** 私钥 PEM 格式（凭据）。 */
  privateKey?: string;

  /** REST API 基础地址。 */
  baseUrl?: string;
  /** WebSocket 地址。 */
  wsUrl?: string;

  /** 应用版本号。 */
  appVersion?: string;
  /** 平台标识。 */
  platform?: string;
  /** 渠道标识（对齐 Python: channel）。 */
  channel?: string;
  /** 是否 Web 端（对齐 Python: web）。 */
  web?: boolean;

  /** 是否使用公告样式发送消息（消息会带上 IMPORTANT 标签）。 */
  useAnnouncementStyle?: boolean;

  /** 用户信息缓存最大条目数。 */
  userinfoCacheMaxEntries?: number;
  /** 用户信息缓存 TTL（秒）。 */
  userinfoCacheTtl?: number;
  /** 区域频道缓存最大条目数。 */
  areaChannelsCacheMaxEntries?: number;
  /** 区域频道缓存 TTL（秒）。 */
  areaChannelsCacheTtl?: number;
  /** 用户资料缓存最大条目数。 */
  personProfilesCacheMaxEntries?: number;
  /** 用户资料缓存 TTL（秒）。 */
  personProfileCacheTtl?: number;
  /** 区域用户昵称缓存最大条目数。 */
  areaUserNicknameCacheMaxEntries?: number;
  /** 区域用户昵称缓存 TTL（秒）。 */
  areaUserNicknameCacheTtl?: number;
  /** 区域成员分页缓存最大条目数。 */
  areaMembersPageCacheMaxEntries?: number;
  /** 区域成员分页缓存 TTL（秒）。 */
  areaMembersPageCacheTtl?: number;

  /**
   * 请求超时（毫秒）。
   * 与 `request.timeout` 等价，二者同时提供时以 `request.timeout` 为准。
   */
  requestTimeout?: number | [number, number];

  /**
   * 请求间隔限流（秒）。
   * 与 `rateLimit.interval` 等价，二者同时提供时以 `rateLimit.interval` 为准。
   */
  rateLimitInterval?: number;

  /** Agora App ID（语音功能需要）。 */
  agoraAppId?: string;

  /** 忽略机器人自己发送的消息（避免自问自答死循环）。 */
  ignoreSelfMessages?: boolean;
  /** 连接后自动订阅已加入的区域。 */
  autoSubscribeJoinedAreas?: boolean;

  /** 请求配置。 */
  request?: RequestConfig;
  /** 重试配置。 */
  retry?: RetryConfig;
  /** 频率限制配置。 */
  rateLimit?: RateLimitConfig;
  /** 心跳配置。 */
  heartbeat?: HeartbeatConfig;
  /** 代理配置。 */
  proxy?: ProxyConfig;

  /** 是否启用调试日志（非 error 的 console.log 输出）。默认 false。 */
  debug?: boolean;
}
