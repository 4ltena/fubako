/**
 * 伏せ判定。ここが製品の心臓。
 *
 * 読み手の地雷語（MuteRule）と投稿のタグを突き合わせる。
 * - 地雷宣言をしていない読み手には何も伏せない
 * - 地雷宣言をしている読み手に対して、タグの無い投稿は「未確認」として伏せる
 * - タグが地雷語と一致（正規化後の完全一致、または語を含む）すれば伏せる
 *
 * 本文を落とすのは呼び出し側（timeline）の責務だが、判定はここに集める。
 */

export const UNCONFIRMED = "未確認";

export type Veil = { veiled: false } | { veiled: true; reason: string };

/** NFKC・小文字・前後空白除去。全角/半角と大小の違いで漏らさない。 */
export function normalizeWord(word: string): string {
  return word.normalize("NFKC").toLowerCase().trim();
}

export function veilFor(tags: readonly string[], muteWords: readonly string[]): Veil {
  const mutes = muteWords.map(normalizeWord).filter((w) => w.length > 0);
  if (mutes.length === 0) return { veiled: false };

  const normalizedTags = tags.map(normalizeWord).filter((t) => t.length > 0);
  if (normalizedTags.length === 0) return { veiled: true, reason: UNCONFIRMED };

  for (const tag of normalizedTags) {
    for (const mute of mutes) {
      if (tag === mute || tag.includes(mute)) {
        // 表示する理由は読み手が登録した語（元の表記）
        const original = muteWords.find((w) => normalizeWord(w) === mute) ?? mute;
        return { veiled: true, reason: original };
      }
    }
  }
  return { veiled: false };
}
