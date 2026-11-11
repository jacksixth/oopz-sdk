export { success, failure } from "./base";
export type { OperationResult, JsonObject, JsonList } from "./base";

export type {
  AreaInfo,
  JoinedAreaInfo,
  ChannelGroupInfo,
  ChannelInfo,
  AreaMembersPage,
  AreaMemberInfo,
  AreaUserDetail,
  AreaRoleInfo,
  RoleInfo,
} from "./area";

export { parseAttachment } from "./attachment";
export type {
  AttachmentType,
  AttachmentBase,
  ImageAttachment,
  AudioAttachment,
  FileAttachment,
  Attachment,
  UploadTicket,
  UploadedFileResult,
} from "./attachment";

export { ChannelType } from "./channel";
export type {
  ChannelSetting,
  CreateChannelResult,
  ChannelEdit,
  ChannelSign,
  VoiceChannelMemberInfo,
  VoiceChannelMembersResult,
} from "./channel";

export type {
  Message,
  MessageReference,
  MessageSendResult,
  MediaInfo,
  PrivateSession,
  MessageEmojiItem,
} from "./message";

export type {
  UserInfo,
  Profile,
  UserLevelInfo,
  Friendship,
  FriendshipRequest,
  UserRemarkNamesResponse,
} from "./person";

export { TextMuteInterval, VoiceMuteInterval } from "./moderation";

export type {
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
  ChannelJoinEvent,
  ChannelLeaveEvent,
  MemberJoinEvent,
  MemberLeaveEvent,
  RoleUpdateEvent,
  FriendAcceptEvent,
  AnyEvent,
} from "./event";

export {
  text,
  mention,
  mentionAll,
  image,
  mentionText,
  mentionAllText,
  normalizeMessageParts,
  buildSegments,
} from "./segment";
export type {
  TextSegment,
  MentionSegment,
  MentionAllSegment,
  ImageSegment,
  Segment,
} from "./segment";
