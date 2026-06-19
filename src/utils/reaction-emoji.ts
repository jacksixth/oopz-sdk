/**
 * 表情符号工具（对齐 Python SDK `reaction_emoji`）。
 */

const EMOJI_MAP: Record<string, string> = {
  "👍": "thumbsup",
  "👎": "thumbsdown",
  "❤️": "heart",
  "😂": "laugh",
  "😮": "surprise",
  "😢": "cry",
  "😡": "angry",
};

/**
 * 将表情符号标准化为 Oopz API 格式。
 * 如果不在映射表中，返回原值。
 */
export function normalizeReactionEmoji(emoji: string): string {
  return EMOJI_MAP[emoji] ?? emoji;
}
