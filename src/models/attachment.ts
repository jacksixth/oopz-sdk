import type { JsonObject } from "./base";

// ── 附件 ──────────────────────────────────────────────

export type AttachmentType = "image" | "audio" | "file";

export interface AttachmentBase {
  attachmentType: AttachmentType;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  url?: string;
}

export interface ImageAttachment extends AttachmentBase {
  attachmentType: "image";
  width?: number;
  height?: number;
}

export interface AudioAttachment extends AttachmentBase {
  attachmentType: "audio";
  duration?: number;
}

export interface FileAttachment extends AttachmentBase {
  attachmentType: "file";
}

export type Attachment = ImageAttachment | AudioAttachment | FileAttachment;

/** 将原始 API 数据解析为附件对象。 */
export function parseAttachment(payload: JsonObject): Attachment {
  const type = (payload["attachmentType"] as string) || "file";
  const base: AttachmentBase = {
    attachmentType: type as AttachmentType,
    fileKey: payload["fileKey"] as string | undefined,
    fileName: payload["fileName"] as string | undefined,
    fileSize: payload["fileSize"] as number | undefined,
    url: payload["url"] as string | undefined,
  };

  switch (type) {
    case "image":
      return {
        ...base,
        attachmentType: "image",
        width: payload["width"] as number | undefined,
        height: payload["height"] as number | undefined,
      };
    case "audio":
      return {
        ...base,
        attachmentType: "audio",
        duration: payload["duration"] as number | undefined,
      };
    default:
      return { ...base, attachmentType: "file" };
  }
}

// ── 上传 ──────────────────────────────────────────────

export interface UploadTicket {
  ticket: string;
  uploadUrl: string;
  fileKey: string;
}

export interface UploadedFileResult {
  fileKey: string;
  url: string;
  width?: number;
  height?: number;
  fileSize?: number;
}
