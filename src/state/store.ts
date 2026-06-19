/**
 * 缓存存储（对齐 Python SDK `CacheStore`）。
 */

import { TTLCache } from "./cache";
import type { Profile, UserInfo, ChannelGroupInfo, AreaMembersPage } from "../models";

export class CacheStore {
  private identity: Profile | null = null;

  private userinfo: TTLCache<UserInfo>;
  private areaChannels: TTLCache<ChannelGroupInfo[]>;
  private personProfiles: TTLCache<Profile>;
  private areaUserNicknames: TTLCache<string>;
  private areaMembersPages: TTLCache<AreaMembersPage>;

  constructor(config: { userinfoCacheMaxEntries?: number; userinfoCacheTtl?: number; areaChannelsCacheMaxEntries?: number; areaChannelsCacheTtl?: number; personProfilesCacheMaxEntries?: number; personProfileCacheTtl?: number; areaUserNicknameCacheMaxEntries?: number; areaUserNicknameCacheTtl?: number; areaMembersPageCacheMaxEntries?: number; areaMembersPageCacheTtl?: number }) {
    this.userinfo = new TTLCache<UserInfo>(
      config.userinfoCacheMaxEntries ?? 5000,
      config.userinfoCacheTtl ?? 1800,
    );
    this.areaChannels = new TTLCache<ChannelGroupInfo[]>(
      config.areaChannelsCacheMaxEntries ?? 1000,
      config.areaChannelsCacheTtl ?? 1800,
    );
    this.personProfiles = new TTLCache<Profile>(
      config.personProfilesCacheMaxEntries ?? 3000,
      config.personProfileCacheTtl ?? 1800,
    );
    this.areaUserNicknames = new TTLCache<string>(
      config.areaUserNicknameCacheMaxEntries ?? 20000,
      config.areaUserNicknameCacheTtl ?? 300,
    );
    this.areaMembersPages = new TTLCache<AreaMembersPage>(
      config.areaMembersPageCacheMaxEntries ?? 200,
      config.areaMembersPageCacheTtl ?? 10,
    );
  }

  // --- identity ---
  getIdentity(): Profile | null {
    return this.identity;
  }
  setIdentity(identity: Profile): void {
    this.identity = identity;
  }
  invalidateIdentity(): void {
    this.identity = null;
  }

  // --- userinfo ---
  getUserinfo(uid: string): UserInfo | undefined {
    return this.userinfo.get(uid);
  }
  setUserinfo(uid: string, user: UserInfo): void {
    this.userinfo.set(uid, user);
  }
  invalidateUserinfo(uid: string): void {
    this.userinfo.delete(uid);
  }
  invalidateUserinfos(): void {
    this.userinfo.clear();
  }

  // --- person profile ---
  getPersonProfile(uid: string): Profile | undefined {
    return this.personProfiles.get(uid);
  }
  setPersonProfile(uid: string, profile: Profile): void {
    this.personProfiles.set(uid, profile);
  }
  invalidatePersonProfile(uid: string): void {
    this.personProfiles.delete(uid);
  }
  invalidatePersonProfiles(): void {
    this.personProfiles.clear();
  }

  // --- area channels ---
  getAreaChannels(area: string): ChannelGroupInfo[] | undefined {
    return this.areaChannels.get(area);
  }
  setAreaChannels(area: string, channels: ChannelGroupInfo[]): void {
    this.areaChannels.set(area, channels);
  }
  invalidateAreaChannels(area: string): void {
    this.areaChannels.delete(area);
  }
  invalidateAllAreaChannels(): void {
    this.areaChannels.clear();
  }

  // --- area members page ---
  getAreaMembersPage(area: string, offsetStart: number, offsetEnd: number): AreaMembersPage | undefined {
    return this.areaMembersPages.get([area, offsetStart, offsetEnd]);
  }
  setAreaMembersPage(area: string, offsetStart: number, offsetEnd: number, page: AreaMembersPage): void {
    this.areaMembersPages.set([area, offsetStart, offsetEnd], page);
  }
  invalidateAreaMembersPages(area?: string): void {
    if (!area) {
      this.areaMembersPages.clear();
      return;
    }
    this.areaMembersPages.deleteWhere((key) => {
      return Array.isArray(key) && key.length >= 1 && key[0] === area;
    });
  }

  // --- area user nicknames ---
  getAreaUserNickname(area: string, uid: string): string | undefined {
    return this.areaUserNicknames.get([area, uid]);
  }
  setAreaUserNickname(area: string, uid: string, nickname: string): void {
    this.areaUserNicknames.set([area, uid], nickname);
  }
  invalidateAreaUserNicknames(area?: string): void {
    if (!area) {
      this.areaUserNicknames.clear();
      return;
    }
    this.areaUserNicknames.deleteWhere((key) => {
      return Array.isArray(key) && key.length >= 1 && key[0] === area;
    });
  }
}
