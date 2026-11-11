/**
 * Oopz Node.js SDK
 *
 * 异步优先、事件驱动、类型友好的 Oopz 语音平台 SDK。
 *
 * @example
 * ```ts
 * import { OopzBot, OopzConfig } from "oopz-sdk";
 *
 * const config = OopzConfig.fromEnv();
 * const bot = new OopzBot(config);
 *
 * bot.on("message", async (event) => {
 *   await event.message.content;
 * });
 *
 * await bot.start();
 * ```
 *
 * @packageDocumentation
 */

// 版本
export { __version__ } from "./version";

// 日志
export { setupLogging, SDK_LOGGER_NAME, sdkLog, setSdkDebug } from "./logger";

// 配置
export {
  OopzConfig,
  DEFAULT_BASE_URL,
  DEFAULT_WS_URL,
  DEFAULT_APP_VERSION,
  DEFAULT_AGORA_APP_ID,
  DEFAULT_REQUEST_TIMEOUT,
  DEFAULT_HEADERS,
  EVENT_SERVER_ID,
  EVENT_AUTH,
  EVENT_AUTH_RESULT,
  EVENT_CHAT_MESSAGE,
  EVENT_HEARTBEAT,
} from "./config";
export type {
  OopzConfigOptions,
  RequestConfig,
  RetryConfig,
  RateLimitConfig,
  HeartbeatConfig,
  ProxyConfig,
} from "./config";

// 认证
export {
  Signer,
  buildOopzHeaders,
  buildOopzApiHeaders,
  OopzLoginCredentials,
  saveCredentialsJson,
  loadCredentialsJson,
  ClientMessageIdGenerator,
  requestId,
  timestampMs,
  timestampUs,
} from "./auth";
export type { OopzLoginCredentialsData } from "./auth";

// 异常
export {
  OopzError,
  OopzApiError,
  OopzAuthError,
  OopzConnectionError,
  OopzRateLimitError,
  OopzParseError,
  OopzTransportError,
  OopzPasswordLoginError,
  AUTH_FAILURE_STATUS_CODES,
} from "./exceptions";

// 客户端
export { OopzBot, OopzRESTClient, OopzWSClient } from "./client";
export type { CloseInfo, OopzWSClientOptions } from "./client/ws";

// 服务
export {
  BaseService,
  Message,
  Media,
  AreaService,
  Channel,
  Person,
  Moderation,
  Voice,
  OopzVoiceUnsupportedError,
} from "./services";

// 事件
export {
  EventParser,
  EventRegistry,
  EventDispatcher,
} from "./events";
export type { EventHandler } from "./events";

// 传输层
export {
  HttpTransport,
  WebSocketTransport,
  WebSocketClosedError,
  buildProxyUrl,
  connectThroughProxy,
  ProxyAgent,
} from "./transport";
export type { HttpRequestOptions, HttpResponse, BaseTransport } from "./transport";

// 状态
export { CacheStore, TTLCache } from "./state";

// 工具
export {
  coerceBool,
  normalizeReactionEmoji,
  stripMarkdown,
  truncateText,
  readImageBytes,
  getImageInfo,
  getImageInfoFromBytes,
  guessImageExt,
  guessImageExtFromBytes,
  formatTimestamp,
  nowMs,
  nowSeconds,
} from "./utils";
export type { ImageInput } from "./utils";

// 模型
export {
  success,
  failure,
  ChannelType,
  TextMuteInterval,
  VoiceMuteInterval,
  parseAttachment,
  text,
  mention,
  mentionAll,
  image,
  mentionText,
  mentionAllText,
  normalizeMessageParts,
  buildSegments,
} from "./models";
export type {
  OperationResult,
  JsonObject,
  JsonList,
  AreaInfo,
  JoinedAreaInfo,
  ChannelGroupInfo,
  ChannelInfo,
  AreaMembersPage,
  AreaMemberInfo,
  AreaUserDetail,
  AreaRoleInfo,
  RoleInfo,
  AttachmentType,
  AttachmentBase,
  ImageAttachment,
  AudioAttachment,
  FileAttachment,
  Attachment,
  UploadTicket,
  UploadedFileResult,
  ChannelSetting,
  CreateChannelResult,
  ChannelEdit,
  ChannelSign,
  VoiceChannelMemberInfo,
  VoiceChannelMembersResult,
  Message as MessageModel,
  MessageReference,
  MessageSendResult,
  MediaInfo,
  PrivateSession,
  MessageEmojiItem,
  UserInfo,
  Profile,
  UserLevelInfo,
  Friendship,
  FriendshipRequest,
  UserRemarkNamesResponse,
  Event,
  EventMap,
  MessageEvent,
  MessageDeleteEvent,
  ServerIdEvent,
  HeartbeatEvent,
  AuthEvent,
  FriendRequestEvent,
  FriendDeleteEvent,
  MessageReactionEvent,
  AreaDisableEvent,
  ChannelUpdateEvent,
  ChannelCreateEvent,
  ChannelDeleteEvent,
  VoicePresenceEvent,
  UserUpdateEvent,
  UserLoginStateEvent,
  AreaUpdateEvent,
  RoleChangedEvent,
  AnyEvent,
  TextSegment,
  MentionSegment,
  MentionAllSegment,
  ImageSegment,
  Segment,
} from "./models";

// 事件码映射参考
export { EVENT_CODE_MAP } from "./config/constants";
