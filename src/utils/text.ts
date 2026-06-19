/**
 * 文本处理工具（对齐 Python SDK）。
 */

/** Markdown 模式移除。 */
const MARKDOWN_PATTERNS: [RegExp, string][] = [
  [/\*\*(.+?)\*\*/gs, "$1"],  // bold
  [/\*(.+?)\*/gs, "$1"],       // italic
  [/~~(.+?)~~/gs, "$1"],       // strikethrough
  [/__(.+?)__/gs, "$1"],       // underline bold
];

/** 移除文本中的 Markdown 标记，返回纯文本。 */
export function stripMarkdown(text: string): string {
  let result = text;
  for (const [pattern, replacement] of MARKDOWN_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** 截断文本到指定长度。 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
