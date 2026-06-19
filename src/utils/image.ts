/**
 * 图片处理工具（对齐 Python SDK `image`）。
 */

import * as fs from "fs";
import * as path from "path";

/** 支持的图片输入类型。 */
export type ImageInput = string | Buffer | Uint8Array;

/** 读取图片字节数据，返回 (payload, filename)。 */
export function readImageBytes(file: ImageInput): [Buffer, string] {
  if (typeof file === "string") {
    const text = file.trim();

    // 优先当作本地路径
    if (fs.existsSync(text)) {
      return [fs.readFileSync(text), path.basename(text)];
    }

    // data URL base64
    const dataUrlMatch = text.match(/^data:(?<mime>[\w/+.-]+);base64,(?<data>.+)$/s);
    if (dataUrlMatch) {
      const mime = dataUrlMatch.groups!.mime;
      const ext = extFromMime(mime);
      return [Buffer.from(dataUrlMatch.groups!.data, "base64"), `image${ext}`];
    }

    // 普通 base64
    try {
      return [Buffer.from(text, "base64"), "image"];
    } catch {
      throw new Error("Image file string is neither an existing path nor valid base64");
    }
  }

  if (Buffer.isBuffer(file)) {
    return [file, "image"];
  }

  if (file instanceof Uint8Array) {
    return [Buffer.from(file), "image"];
  }

  throw new TypeError(`Unsupported image input type: ${typeof file}`);
}

/** 从 MIME 类型推断扩展名。 */
function extFromMime(mime: string): string {
  const mapping: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
  };
  return mapping[mime] ?? ".jpg";
}

/**
 * 获取图片信息（宽、高、文件大小）。
 * 注意：Node.js 环境下需要 image-size 等包来获取尺寸。
 * 这里提供基本实现，高级用法依赖外部库。
 */
export function getImageInfo(file: ImageInput): [number, number, number] {
  const [payload] = readImageBytes(file);
  return getImageInfoFromBytes(payload);
}

/** 从字节数据获取图片信息。 */
export function getImageInfoFromBytes(data: Buffer): [number, number, number] {
  // 基础实现：尝试解析 PNG/JPEG/GIF 头部获取尺寸
  let width = 0;
  let height = 0;

  if (data[0] === 0x89 && data[1] === 0x50) {
    // PNG: 前8字节是签名，接下来4字节是宽度，再4字节是高度
    width = data.readUInt32BE(16);
    height = data.readUInt32BE(20);
  } else if (data[0] === 0xff && data[1] === 0xd8) {
    // JPEG: 扫描 SOF 标记获取尺寸
    let i = 2;
    while (i < data.length - 1) {
      if (data[i] === 0xff) {
        const marker = data[i + 1];
        if (marker >= 0xc0 && marker <= 0xc3 && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          height = (data[i + 5] << 8) | data[i + 6];
          width = (data[i + 7] << 8) | data[i + 8];
          break;
        }
        i += 2 + ((data[i + 2] << 8) | data[i + 3]);
      } else {
        i++;
      }
    }
  } else if (data[0] === 0x47 && data[1] === 0x49) {
    // GIF: 逻辑屏幕描述符
    width = data.readUInt16LE(6);
    height = data.readUInt16LE(8);
  }

  return [width, height, data.length];
}

/** 推断图片扩展名。 */
export function guessImageExt(file: ImageInput): string {
  const [payload, filename] = readImageBytes(file);
  return guessImageExtFromBytes(payload, filename);
}

/** 从字节数据推断扩展名。 */
export function guessImageExtFromBytes(data: Buffer, filename: string = "image"): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext && [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(ext)) {
    return ext;
  }

  // 根据 magic bytes 判断
  if (data[0] === 0x89 && data[1] === 0x50) return ".png";
  if (data[0] === 0xff && data[1] === 0xd8) return ".jpg";
  if (data[0] === 0x47 && data[1] === 0x49) return ".gif";
  if (data[0] === 0x52 && data[1] === 0x49) return ".webp";
  if (data[0] === 0x42 && data[1] === 0x4d) return ".bmp";

  return ".jpg";
}
