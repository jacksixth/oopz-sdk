/** 成功登录后返回的凭据信息。 */
export interface OopzLoginCredentials {
  deviceId: string;
  personUid: string;
  jwtToken: string;
  privateKey: string;
  appVersion: string;
}

/** 将凭据保存到 JSON 文件。 */
export function saveCredentialsJson(
  credentials: OopzLoginCredentials,
  filepath: string
): void {
  const fs = require("node:fs");
  fs.writeFileSync(filepath, JSON.stringify(credentials, null, 2), "utf-8");
}

/** 从 JSON 文件加载凭据。 */
export function loadCredentialsJson(filepath: string): OopzLoginCredentials {
  const fs = require("node:fs");
  const raw = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(raw) as OopzLoginCredentials;
}
