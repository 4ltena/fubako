/**
 * 招待の言葉。
 *
 * 「中にいる人から言葉をもらった人だけが入れる」（デザイン案 1d）ので、口で言えて
 * 書き写せる形にする。ひらがな10文字。
 *
 * 紛らわしい字は使わない: ん（語末で聞き取りにくい）、を（お と区別しにくい）、
 * 小書き・濁点・半濁点（聞き取りと入力の揺れが大きい）。
 * 残る44字を10文字で 44^10 ≒ 2.7×10^16（約54.6ビット）。会員しか叩けない参加 API に対しては十分。
 *
 * 既存の base64url な招待コードはそのまま有効。正規化で大小を潰さないのはそのため。
 * Node から直接読めるよう、このファイルは何も import しない。
 */

export const INVITE_ALPHABET = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ";
export const INVITE_LENGTH = 10;

/** カタカナをひらがなに寄せる。濁点つきは合成済みでも分解済みでも通す。 */
function toHiragana(s: string): string {
  return s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/**
 * 打ち間違い以外の揺れを吸収する。全角半角・カタカナ・空白・改行・中黒だけを均す。
 * 大文字小文字も、記号（- と _）も潰さない。既存の base64url コードを壊さないため。
 */
export function normalizeInvite(input: string): string {
  return toHiragana(input.normalize("NFKC")).replace(/[\s\u3000・]/g, "");
}

/** 招待の言葉を作る。偏りが出ないよう剰余ではなく randomInt を使う。 */
export function makeInvite(randomInt: (max: number) => number): string {
  const chars = [...INVITE_ALPHABET];
  let out = "";
  for (let i = 0; i < INVITE_LENGTH; i++) out += chars[randomInt(chars.length)];
  return out;
}
