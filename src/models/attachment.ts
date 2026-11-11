import type { JsonObject } from "./base";

// ── 附件类型 ────────────────────────────────────────────

/**
 * 附件类型（对齐 Python SDK / Oopz 协议，使用大写枚举值）。
 */
export type AttachmentType = "IMAGE" | "AUDIO" | "FILE";

export interface AttachmentBase {
  attachmentType: AttachmentType;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  url?: string;
  previewFileKey?: string;
}

export interface ImageAttachment extends AttachmentBase {
  attachmentType: "IMAGE";
  width?: number;
  height?: number;
}

export interface AudioAttachment extends AttachmentBase {
  attachmentType: "AUDIO";
  duration?: number;
}

export interface FileAttachment extends AttachmentBase {
  attachmentType: "FILE";
}

export type Attachment = ImageAttachment | AudioAttachment | FileAttachment;

/**
 * 将原始 API 数据解析为附件对象。
 *
 * 协议里的 `attachmentType` 是大写（IMAGE/AUDIO/FILE），这里做大小写归一化，
 * 避免服务端返回小写时被误判为普通文件。
 */
export function parseAttachment(payload: JsonObject): Attachment {
  const rawType = String(payload["attachmentType"] ?? "").toUpperCase();
  const base: AttachmentBase = {
    attachmentType: (rawType === "IMAGE" || rawType === "AUDIO" ? rawType : "FILE") as AttachmentType,
    fileKey: (payload["fileKey"] as string) ?? undefined,
    fileName: (payload["fileName"] as string) ?? undefined,
    fileSize: (payload["fileSize"] as number) ?? undefined,
    url: (payload["url"] as string) ?? undefined,
    previewFileKey: (payload["previewFileKey"] as string) ?? undefined,
  };

  switch (base.attachmentType) {
    case "IMAGE":
      return {
        ...base,
        attachmentType: "IMAGE",
        width: (payload["width"] as number) ?? undefined,
        height: (payload["height"] as number) ?? undefined,
      };
    case "AUDIO":
      return {
        ...base,
        attachmentType: "AUDIO",
        duration: (payload["duration"] as number) ?? undefined,
      };
    default:
      return { ...base, attachmentType: "FILE" };
  }
}

// ── 上传 ──────────────────────────────────────────────

export interface UploadTicket {
  /** 上传授权票据。 */
  auth?: string;
  /** 预签名上传地址（协议字段 signedUrl）。 */
  signedUrl: string;
  /** 文件标识（协议字段 file）。 */
  fileKey: string;
  /** 访问地址。 */
  url: string;
  /** 有效期（秒）。 */
  expireInSecond?: number;
}

export interface UploadedFileResult {
  fileKey: string;
  url: string;
  fileType?: string;
  displayName?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  animated?: boolean;
}
