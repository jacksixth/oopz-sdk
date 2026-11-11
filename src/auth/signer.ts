import * as crypto from "node:crypto";
import { OopzConfig } from "../config";
import { ClientMessageIdGenerator, requestId, timestampMs, timestampUs } from "./ids";

/**
 * Oopz API RSA 签名器（对齐 Python SDK）。
 * 使用 RSA PKCS1v15 + SHA256 签名，Base64 编码。
 */
export class Signer {
  private config: OopzConfig;
  private privateKeyObj: crypto.KeyObject | null = null;
  private idGen = new ClientMessageIdGenerator();

  constructor(config: OopzConfig) {
    this.config = config;

    // dotenv 不会把 \n 转成换行，手动转换
    const pem = (config.privateKey || "").replace(/\\n/g, "\n");
    if (pem) {
      try {
        this.privateKeyObj = crypto.createPrivateKey({
          key: pem,
          format: "pem",
          type: "pkcs8",
        });
      } catch {
        try {
          this.privateKeyObj = crypto.createPrivateKey({
            key: pem,
            format: "pem",
            type: "pkcs1",
          });
        } catch (e) {
          console.warn("[oopz-sdk] 无法解析 PEM 私钥:", (e as Error).message);
        }
      }
    }
  }

  /** 计算 (url_path + body_str) 的 MD5 哈希（对齐 Python body_md5）。 */
  bodyMd5(urlPath: string, bodyStr: string): string {
    const combined = urlPath + bodyStr;
    return crypto.createHash("md5").update(combined, "utf8").digest("hex");
  }

  /**
   * RSA PKCS1v15 + SHA256 签名（对齐 Python sign(md5+ts)）。
   * 无私钥返回空字符串。
   */
  sign(data: string): string {
    if (!this.privateKeyObj) {
      if (!Signer._warnedMissingKey) {
        Signer._warnedMissingKey = true;
        console.warn(
          "\n⚠️  未配置 OOPZ_PRIVATE_KEY，REST API 签名将为空（会导致 401）。\n" +
          "   获取方式：浏览器登录 web.oopz.cn → F12 Console → 粘贴提取脚本\n" +
          "   （详见 README.md 的「🔑 如何获取凭据」章节，含一键提取全部凭据的 JS 脚本）\n" +
          "   注意：私钥在 .env 中须用 \\n 单行格式。\n"
        );
      }
      return "";
    }
    // RSA PKCS1v15 + SHA256 签名，然后 Base64 编码（对齐 Python）
    const sig = crypto.sign("sha256", Buffer.from(data, "utf8"), {
      key: this.privateKeyObj,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    });
    return sig.toString("base64");
  }

  static _warnedMissingKey = false;

  /** 当前毫秒级时间戳（Unix epoch，对齐 Python timestamp_ms）。 */
  timestampMs(): string {
    return timestampMs();
  }

  /**
   * 当前微秒级时间戳（Unix epoch，对齐 Python timestamp_us）。
   *
   * 注意：必须使用 Unix epoch，不能用 `process.hrtime()`——后者是单调时钟，
   * 起点是系统启动时刻，与服务端期望的 epoch 毫秒完全对不上。
   */
  timestampUs(): string {
    return timestampUs();
  }

  /** 生成唯一的请求 ID（对齐 Python request_id）。 */
  requestId(): string {
    return requestId();
  }

  /**
   * 生成客户端消息 ID（对齐 Python ClientMessageIdGenerator.generate）。
   * 格式：timestamp_us % 10^13 * 100 + random(10, 99)
   */
  clientMessageId(): string {
    return this.idGen.generate();
  }
}

/**
 * 构建 Oopz API 请求头（对齐 Python build_oopz_headers）。
 *
 * @param urlPath 用于参与 MD5 的路径（不含 base URL）
 * @param bodyStr 用于参与 MD5 的请求体字符串
 */
export function buildOopzApiHeaders(
  config: OopzConfig,
  signer: Signer,
  urlPath: string,
  bodyStr: string
): Record<string, string> {
  const ts = signer.timestampMs();
  const md5 = signer.bodyMd5(urlPath, bodyStr);
  const signature = signer.sign(md5 + ts);

  return {
    "Oopz-Sign": signature,
    "Oopz-Request-Id": signer.requestId(),
    "Oopz-Time": ts,
    "Oopz-App-Version-Number": config.appVersion,
    "Oopz-Channel": config.channel,
    "Oopz-Device-Id": config.deviceId,
    "Oopz-Platform": config.platform,
    "Oopz-Web": String(config.web),
    "Oopz-Person": config.personUid,
    "Oopz-Signature": config.jwtToken,
  };
}
