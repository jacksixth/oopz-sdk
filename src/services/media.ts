import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { BaseService } from "./base";
import type { UploadTicket, UploadedFileResult } from "../models";
import type { JsonObject } from "../models/base";
import { readImageBytes, guessImageExt, getImageInfoFromBytes } from "../utils/image";
import type { ImageInput } from "../utils/image";

/**
 * 媒体服务 — 上传并管理文件/图像。
 *
 * 路径对齐 Python SDK：先 `PUT /rtc/v1/cos/v1/signedUploadUrl` 换取
 * 预签名地址，再把二进制 PUT 到该地址。
 */
export class Media extends BaseService {
  /**
   * 上传图像并返回上传信息。
   *
   * `input` 可以是本地路径、data URL、HTTP URL 或 Buffer。
   */
  async uploadImage(input: ImageInput): Promise<UploadedFileResult> {
    const { data, fileName, mimeType } = await this.resolveImageInput(input);

    // 1. 获取上传凭证
    const ticket = await this.getUploadTicket(fileName, mimeType);

    // 2. 上传到预签名地址
    await this.uploadToUrl(ticket.signedUrl, data);

    return {
      fileKey: ticket.fileKey,
      url: ticket.url,
      fileType: "IMAGE",
      displayName: fileName,
      fileSize: data.length,
      width: getImageInfoFromBytes(data)[0] || undefined,
      height: getImageInfoFromBytes(data)[1] || undefined,
    };
  }

  /**
   * 获取文件的上传凭证（对齐 Python Media.upload_bytes）。
   */
  private async getUploadTicket(
    fileName: string,
    mimeType: string
  ): Promise<UploadTicket> {
    const body: JsonObject = {
      type: "IMAGE",
      ext: guessImageExt(fileName).replace(/^\./, "") || "png",
    };

    const result = await this.transport.put<JsonObject>("/rtc/v1/cos/v1/signedUploadUrl", body);
    const data = (result["data"] || result) as JsonObject;

    // 协议字段名：file（文件标识）/ signedUrl（预签名地址）/ url（访问地址）
    const fileKey = (data["file"] || data["fileKey"] || "") as string;
    const signedUrl = (data["signedUrl"] || data["uploadUrl"] || data["signed_url"] || "") as string;
    const url = (data["url"] || "") as string;

    if (!fileKey || !signedUrl) {
      throw new Error("invalid upload ticket payload: missing file/signedUrl");
    }

    return {
      auth: (data["auth"] || "") as string | undefined,
      signedUrl,
      fileKey,
      url,
      expireInSecond: (data["expireInSecond"] || 0) as number | undefined,
    };
  }

  /**
   * 将原始数据上传到预签名 URL。
   */
  private async uploadToUrl(
    url: string,
    data: Buffer
  ): Promise<void> {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(data),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * 解析各种图像输入格式为原始数据。
   */
  private async resolveImageInput(
    input: ImageInput
  ): Promise<{ data: Buffer; fileName: string; mimeType: string }> {
    if (Buffer.isBuffer(input)) {
      return {
        data: input,
        fileName: `image_${crypto.randomUUID()}.png`,
        mimeType: "image/png",
      };
    }

    if (input instanceof Uint8Array) {
      const data = Buffer.from(input);
      return {
        data,
        fileName: `image_${crypto.randomUUID()}.${guessImageExt(data).replace(/^\./, "")}`,
        mimeType: "image/png",
      };
    }

    // 文件路径 / data URL / HTTP URL / base64
    if (typeof input === "string") {
      const text = input.trim();

      // HTTP URL
      if (text.startsWith("http://") || text.startsWith("https://")) {
        const response = await fetch(text);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const data = Buffer.from(await response.arrayBuffer());
        const mimeType = response.headers.get("content-type") || "image/png";
        const ext = guessImageExt(data).replace(/^\./, "");
        return { data, fileName: `image_${crypto.randomUUID()}.${ext}`, mimeType };
      }

      // 本地文件路径
      if (fs.existsSync(text) && !text.startsWith("data:")) {
        const data = fs.readFileSync(text);
        const mimeType = mimeTypeFromExt(path.extname(text));
        return { data, fileName: path.basename(text), mimeType };
      }

      // data URL / base64
      const data = readImageBytes(text)[0];
      const mimeType = mimeTypeFromExt(guessImageExt(data));
      return {
        data,
        fileName: `image_${crypto.randomUUID()}.${guessImageExt(data).replace(/^\./, "")}`,
        mimeType,
      };
    }

    throw new Error("Invalid image input type");
  }
}

/** 根据扩展名推断 MIME 类型。 */
function mimeTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };
  return map[ext.toLowerCase()] || "image/png";
}
