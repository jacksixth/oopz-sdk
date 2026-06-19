/**
 * Oopz 登录凭据（对齐 Python SDK `OopzLoginCredentials`）。
 */

import { OopzPasswordLoginError } from "../exceptions";
import { OopzConfig } from "../config";

/** 一次 OOPZ 登录后提取到的 SDK 凭据。 */
export interface OopzLoginCredentialsData {
  deviceId: string;
  personUid: string;
  jwtToken: string;
  privateKey: string;
  appVersion?: string;
  expiresAt?: string;
  expiresInSeconds?: number | null;
}

export class OopzLoginCredentials {
  deviceId: string;
  personUid: string;
  jwtToken: string;
  privateKey: string;
  appVersion: string;
  expiresAt: string;
  expiresInSeconds: number | null;

  constructor(data: OopzLoginCredentialsData) {
    this.deviceId = this._requiredText(data.deviceId, "device_id");
    this.personUid = this._requiredText(data.personUid, "person_uid");
    this.jwtToken = this._requiredText(data.jwtToken, "jwt_token");
    this.privateKey = this._requiredText(data.privateKey || (data as any).private_key_pem, "private_key");
    this.appVersion = data.appVersion ?? "";
    this.expiresAt = data.expiresAt ?? "";
    this.expiresInSeconds = data.expiresInSeconds ?? null;
  }

  private _requiredText(value: unknown, fieldName: string): string {
    const text = String(value ?? "").trim();
    if (!text) {
      throw new OopzPasswordLoginError(`${fieldName} is required`);
    }
    return text;
  }

  /** 从字典创建凭据对象。 */
  static fromMapping(data: Record<string, unknown>): OopzLoginCredentials {
    const privateKey = (data.private_key_pem || data.private_key || data.privateKey) as string | undefined;
    return new OopzLoginCredentials({
      deviceId: data.device_id as string ?? data.deviceId as string ?? "",
      personUid: data.person_uid as string ?? data.personUid as string ?? "",
      jwtToken: data.jwt_token as string ?? data.jwtToken as string ?? "",
      privateKey: privateKey ?? "",
      appVersion: (data.app_version as string) ?? (data.appVersion as string) ?? "",
      expiresAt: (data.expires_at as string) ?? (data.expiresAt as string) ?? "",
      expiresInSeconds: (data.expires_in_seconds as number) ?? (data.expiresInSeconds as number) ?? null,
    });
  }

  /** 转换为 OopzConfig。 */
  toConfig(overrides: Record<string, unknown> = {}): OopzConfig {
    const values: Record<string, unknown> = {
      deviceId: this.deviceId,
      personUid: this.personUid,
      jwtToken: this.jwtToken,
      privateKey: this.privateKey,
      ...overrides,
    };
    if (this.appVersion) {
      values.appVersion = this.appVersion;
    }
    return new OopzConfig(values as any);
  }

  /** 从环境变量读取凭据。 */
  static fromEnv(prefix: string = "OOPZ_"): OopzLoginCredentials {
    return OopzLoginCredentials.fromMapping({
      device_id: process.env[`${prefix}DEVICE_ID`],
      person_uid: process.env[`${prefix}PERSON_UID`],
      jwt_token: process.env[`${prefix}JWT_TOKEN`],
      private_key: process.env[`${prefix}PRIVATE_KEY`],
      app_version: process.env[`${prefix}APP_VERSION`] ?? "",
    });
  }

  /** 转换为适合保存的字典。 */
  toDict(includePrivateKey: boolean = true): Record<string, unknown> {
    const data: Record<string, unknown> = {
      device_id: this.deviceId,
      person_uid: this.personUid,
      jwt_token: this.jwtToken,
      app_version: this.appVersion,
    };
    if (includePrivateKey) {
      data.private_key = this.privateKey;
    }
    if (this.expiresAt) {
      data.expires_at = this.expiresAt;
    }
    if (this.expiresInSeconds !== null) {
      data.expires_in_seconds = this.expiresInSeconds;
    }
    return data;
  }

  /** 返回脱敏摘要。 */
  masked(): Record<string, unknown> {
    return {
      device_id: this._mask(this.deviceId),
      person_uid: this._mask(this.personUid),
      jwt_token: this._mask(this.jwtToken, 10),
      private_key: !!this.privateKey,
      app_version: this.appVersion,
      expires_at: this.expiresAt,
      expires_in_seconds: this.expiresInSeconds,
    };
  }

  private _mask(value: string | null, keep: number = 4): string {
    const text = String(value ?? "");
    if (!text) return "";
    if (text.length <= keep * 2) return text.slice(0, keep) + "***";
    return `${text.slice(0, keep)}***${text.slice(-keep)}`;
  }
}

/** 把凭据保存为 UTF-8 JSON 文件。 */
export function saveCredentialsJson(credentials: OopzLoginCredentials, path: string): string {
  const fs = require("fs");
  const dir = require("path").dirname(path);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, JSON.stringify(credentials.toDict(), null, 2) + "\n", "utf-8");
  return path;
}

/** 从 UTF-8 JSON 文件读取凭据。 */
export function loadCredentialsJson(path: string): OopzLoginCredentials {
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(path, "utf-8"));
  if (typeof data !== "object" || data === null) {
    throw new OopzPasswordLoginError("凭据 JSON 必须是对象");
  }
  return OopzLoginCredentials.fromMapping(data);
}
