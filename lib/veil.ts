/**
 * 伏せ判定。ここが製品の心臓。
 *
 * 読み手の地雷語（MuteRule）と投稿のタグを突き合わせる。
 * - 読み手が自分でその投稿を伏せていれば、他の条件に関係なく伏せる
 * - 地雷宣言をしていない読み手には何も伏せない
 * - 地雷宣言をしている読み手に対して、タグの無い投稿は「未確認」として伏せる
 * - タグが地雷語と一致（正規化後の完全一致、または語を含む）すれば伏せる
 * - 書き手の注意文（cw）があれば地雷宣言より優先して伏せる
 *
 * 伏せた理由には種類（kind）を付ける。読み手に見せる文言を分けるためで、
 * 種類そのものは新しい情報を渡さない（reason から同じ区別が付く）。
 * ただし timeline が伏せた投稿のタグを落とす方針を変えるときは、ここも見直すこと。
 *
 * 本文を落とすのは呼び出し側（timeline）の責務だが、判定はここに集める。
 */

export const UNCONFIRMED = "未確認";

/** 伏せた理由の種類。self=読み手が自分で伏せた / cw=書き手の注意文 / mute=宣言した語 / unconfirmed=タグが無い */
export type VeilKind = "self" | "cw" | "mute" | "unconfirmed";

export type Veil = { veiled: false } | { veiled: true; reason: string; kind: VeilKind };

export type VeilOptions = {
  /** 読み手がこの投稿を自分で伏せているか。 */
  selfVeiled?: boolean;
};

/** NFKC・小文字・前後空白除去。全角/半角と大小の違いで漏らさない。 */
export function normalizeWord(word: string): string {
  return word.normalize("NFKC").toLowerCase().trim();
}

export function veilFor(
  tags: readonly string[],
  muteWords: readonly string[],
  cw?: string | null,
  options: VeilOptions = {},
): Veil {
  // 読み手自身が閉じた紙。取り消せる操作なので、他のどの理由より先に効かせる。
  if (options.selfVeiled) return { veiled: true, reason: "自分で伏せています", kind: "self" };

  const warning = cw?.trim();
  if (warning) return { veiled: true, reason: warning, kind: "cw" };

  const mutes = muteWords.map(normalizeWord).filter((w) => w.length > 0);
  if (mutes.length === 0) return { veiled: false };

  const normalizedTags = tags.map(normalizeWord).filter((t) => t.length > 0);
  if (normalizedTags.length === 0) return { veiled: true, reason: UNCONFIRMED, kind: "unconfirmed" };

  for (const tag of normalizedTags) {
    for (const mute of mutes) {
      if (tag === mute || tag.includes(mute)) {
        // 表示する理由は読み手が登録した語（元の表記）
        const original = muteWords.find((w) => normalizeWord(w) === mute) ?? mute;
        return { veiled: true, reason: original, kind: "mute" };
      }
    }
  }
  return { veiled: false };
}
