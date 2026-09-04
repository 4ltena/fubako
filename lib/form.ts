/**
 * 投稿の「形」。書き手には選ばせず、本文と画像から自動で決める（原則 A「選ばせない」）。
 *
 * 「内側をどれだけ出したか」を数や指標にせず、見た目の違いだけで表す。
 * 形は伏せた投稿には渡さない（形から本文の内容が推測できるため）。
 *
 * 閾値は根拠のない暫定値。ここを直せば全体が動くように定数にまとめてある。
 */

export type Form = "sentence" | "picture" | "verse" | "text";

/** 一文とみなす最大文字数。暫定40。 */
export const SENTENCE_MAX_CHARS = 40;
/** 一句とみなす行数。暫定3行。 */
export const VERSE_LINES = 3;
/** 一句の各行の最大文字数。暫定10。 */
export const VERSE_MAX_CHARS_PER_LINE = 10;

/** 書記素まで数えると重いので符号位置で数える。絵文字1つは1文字。 */
function chars(s: string): number {
  return [...s].length;
}

export function inferForm(body: string, imageCount: number): Form {
  const text = body.trim();
  // 1. 画像があって本文が空（空白のみ含む）
  if (imageCount >= 1 && text.length === 0) return "picture";
  // 2. 改行を含まず短い
  if (!text.includes("\n") && chars(text) <= SENTENCE_MAX_CHARS) return "sentence";
  // 3. 3行で各行が短い
  const lines = text.split("\n");
  if (lines.length === VERSE_LINES && lines.every((l) => chars(l.trim()) <= VERSE_MAX_CHARS_PER_LINE)) return "verse";
  return "text";
}
