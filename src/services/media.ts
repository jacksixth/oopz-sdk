import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { BaseService } from "./base";
import type { UploadTicket, UploadedFileResult } from "../models";
import type { JsonObject } from "../models/base";

export type ImageInput = string | Buffer;

/**
 * 媒体服务 — 上传并管理文件/图像。
 */
export class Media extends BaseService {
  /**
   * 上传图像并返回上传信息。
   */
  async uploadImage(input: ImageInput): Promise<UploadedFileResult> {
    const { data, fileName, mimeType } = await this.resolveImageInput(input);

    // 1. 获取上传凭证
    const ticket = await this.getUploadTicket(fileName, mimeType, data.length);

    // 2. 上传到提供的 URL
    await this.uploadToUrl(ticket.uploadUrl, data, mimeType);

    return {
      fileKey: ticket.fileKey,
      url: "", // URL 通常由服务端根据 fileKey 构造
      fileSize: data.length,
    };
  }

  /**
   * 获取文件的上传凭证。
   */
  private async getUploadTicket(
    fileName: string,
    mimeType: string,
    fileSize: number
  ): Promise<UploadTicket> {
    const body: JsonObject = {
      type: "IMAGE",
      ext: path.extname(fileName).slice(1) || "png",
    };

    const result = await this.transport.put<JsonObject>("/rtc/v1/cos/v1/signedUploadUrl", body);
    return {
      ticket: (result["ticket"] || "") as string,
      uploadUrl: (result["uploadUrl"] || result["upload_url"] || "") as string,
      fileKey: (result["fileKey"] || result["file_key"] || "") as string,
    };
  }

  /**
   * 将原始数据上传到预签名 URL。
   */
  private async uploadToUrl(
    url: string,
    data: Buffer,
    mimeType: string
  ): Promise<void> {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(data.length),
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

    // 文件路径
    if (typeof input === "string") {
      // 数据 URL
      if (input.startsWith("data:")) {
        const match = input.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const data = Buffer.from(match[2], "base64");
          const ext = mimeType.split("/")[1] || "png";
          return { data, fileName: `image_${crypto.randomUUID()}.${ext}`, mimeType };
        }
      }

      // HTTP URL
      if (input.startsWith("http://") || input.startsWith("https://")) {
        const response = await fetch(input);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        const data = Buffer.from(await response.arrayBuffer());
        const mimeType = response.headers.get("content-type") || "image/png";
        const ext = mimeType.split("/")[1] || "png";
        return { data, fileName: `image_${crypto.randomUUID()}.${ext}`, mimeType };
      }

      // 本地文件路径
      const data = fs.readFileSync(input);
      const ext = path.extname(input).slice(1) || "png";
      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        bmp: "image/bmp",
      };
      const mimeType = mimeMap[ext.toLowerCase()] || "image/png";
      return {
        data,
        fileName: path.basename(input),
        mimeType,
      };
    }

    throw new Error("Invalid image input type");
  }
}
