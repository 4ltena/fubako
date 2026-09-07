/**
 * 伏せ判定。ここが製品の心臓。
 *
 * 本文・注意文・タグと、読み手本人の登録語だけを突き合わせる。
 * 他人の登録語は取得も返却もしない。
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

export type VeilContent = {
  body: string;
  cw?: string | null;
  tags: readonly string[];
};

export type VeilOptions = {
  /** 読み手がこの投稿を自分で伏せているか。 */
  selfVeiled?: boolean;
};

/** NFKC・小文字・カタカナからひらがな・前後空白除去。語中の記号や空白は残す。 */
export function normalizeWord(word: string): string {
  return word
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .trim();
}

function matches(text: string, mute: string): boolean {
  return normalizeWord(text).includes(mute);
}

export function veilFor(
  content: VeilContent,
  muteWords: readonly string[],
  options: VeilOptions = {},
): Veil {
  if (options.selfVeiled) return { veiled: true, reason: "自分で伏せています", kind: "self" };

  const mutes = muteWords
    .map((original) => ({ original, normalized: normalizeWord(original) }))
    .filter(({ normalized }) => normalized.length > 0);
  const searchable = [content.body, content.cw ?? "", ...content.tags];
  for (const mute of mutes) {
    if (searchable.some((text) => matches(text, mute.normalized))) {
      return { veiled: true, reason: mute.original, kind: "mute" };
    }
  }

  const warning = content.cw?.trim();
  if (warning) return { veiled: true, reason: warning, kind: "cw" };
  if (mutes.length > 0 && !content.tags.some((tag) => normalizeWord(tag).length > 0)) {
    return { veiled: true, reason: UNCONFIRMED, kind: "unconfirmed" };
  }
  return { veiled: false };
}
