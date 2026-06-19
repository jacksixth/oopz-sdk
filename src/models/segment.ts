import type { Attachment } from "./attachment";

// ── 消息分段类型 ───────────────────────────────────────

/** 文本分段。 */
export interface TextSegment {
  type: "text";
  text: string;
}

/** @提及指定用户。 */
export interface MentionSegment {
  type: "mention";
  userId: string;
}

/** @提及全体成员。 */
export interface MentionAllSegment {
  type: "mention_all";
}

/** 图片分段（路径、Buffer、base64 或 URL）。 */
export interface ImageSegment {
  type: "image";
  /** 文件路径、Buffer、base64 data URL 或 HTTP URL。 */
  source: string | Buffer;
  /** 可选的 MIME 类型覆盖。 */
  mimeType?: string;
  /** 已解析的上传信息。 */
  uploaded?: {
    fileKey: string;
    url: string;
    width?: number;
    height?: number;
  };
}

export type Segment = TextSegment | MentionSegment | MentionAllSegment | ImageSegment;

// ── 辅助函数 ────────────────────────────────────────────

export function text(content: string): TextSegment {
  return { type: "text", text: content };
}

export function mention(userId: string): MentionSegment {
  return { type: "mention", userId };
}

export function mentionAll(): MentionAllSegment {
  return { type: "mention_all" };
}

export function image(source: string | Buffer, mimeType?: string): ImageSegment {
  return { type: "image", source, mimeType };
}

/**
 * 将混合的消息部分（字符串或 Segment）标准化为 Segment 数组。
 */
export function normalizeMessageParts(
  parts: (string | Segment)[]
): Segment[] {
  return parts.map((p) => (typeof p === "string" ? text(p) : p));
}

/**
 * 根据已解析的 segment 列表构建纯文本内容和附件列表。
 * 调用前必须先解析（上传）图片分段。
 */
export function buildSegments(
  segments: Segment[]
): { text: string; attachments: Attachment[] } {
  const textParts: string[] = [];
  const attachments: Attachment[] = [];

  for (const seg of segments) {
    switch (seg.type) {
      case "text":
        textParts.push(seg.text);
        break;
      case "mention":
        textParts.push(`@${seg.userId}`);
        break;
      case "mention_all":
        textParts.push("@all");
        break;
      case "image":
        if (seg.uploaded) {
          textParts.push(
            `![IMAGEw${seg.uploaded.width || 0}h${seg.uploaded.height || 0}](${seg.uploaded.fileKey})`
          );
          attachments.push({
            attachmentType: "image",
            fileKey: seg.uploaded.fileKey,
            url: seg.uploaded.url,
            width: seg.uploaded.width,
            height: seg.uploaded.height,
          });
        }
        break;
    }
  }

  return { text: textParts.join(""), attachments };
}
