import type { JsonObject } from "./base";

// ── 用户 ────────────────────────────────────────────────

export interface UserInfo {
  uid: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  level?: number;
}

export interface Profile {
  uid: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  gender?: number;
  birthday?: string;
}

export interface UserLevelInfo {
  authDesc: string;
  authState: number;
  currentLevel: number;
  currentLevelFullPoints: number;
  hasNotReceivePrize: boolean;
  nextLevel: number;
  nextLevelDistance: number;
  payPoints: number;
  signInPoints: number;
}

// ── 好友 ──────────────────────────────────────────

export interface Friendship {
  uid: string;
  nickname: string;
  avatar?: string;
  remark?: string;
  isOnline?: boolean;
}

export interface FriendshipRequest {
  requestId: string;
  fromUid: string;
  fromNickname: string;
  fromAvatar?: string;
  message?: string;
  timestamp: string;
}

export interface UserRemarkNamesResponse {
  remarks: Record<string, string>;
}
