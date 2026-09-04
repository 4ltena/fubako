/**
 * 書きかけを端末に残す。
 *
 * 「準備時間が感情の寿命を超えると投稿が起きない」（企画書 1章）ので、画面を離れても
 * 本文が消えないようにする。ただし催促はしない — 件数もバッジも「下書きがあります」も出さない。
 * ただ入っているだけ。
 *
 * 残すのは本文だけ。置き場所は読み手の端末（localStorage）で、サーバには送らない。
 * 保持は24時間。投稿の寿命（他人から見える期間）とは別の話なので、定数も別に持つ。
 *
 * scope は「誰の・どの箱の書きかけか」を表す鍵。同じ端末を別の人が使っても混ざらないよう、
 * 呼び出し側が「ユーザーID:サークルID」を渡す。
 */

/** 端末に置いておく時間。暫定24時間。投稿の寿命とは根拠が違う。 */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type DraftStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function draftKey(scope: string): string {
  return `fubako.draft.${scope}`;
}

/** 端末の保管庫。private モードなどで触れないことがあるので、掴めなければ null。 */
export function browserStore(): DraftStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** 書きかけを取り出す。無い・古い・壊れている場合は空文字。 */
export function loadDraft(scope: string, store: DraftStore | null, now: number): string {
  if (!store) return "";
  let raw: string | null = null;
  try {
    raw = store.getItem(draftKey(scope));
  } catch {
    return "";
  }
  if (!raw) return "";
  try {
    const saved = JSON.parse(raw) as { body?: unknown; at?: unknown };
    if (typeof saved.body !== "string" || typeof saved.at !== "number") return "";
    if (now - saved.at > DRAFT_TTL_MS) {
      clearDraft(scope, store);
      return "";
    }
    return saved.body;
  } catch {
    return "";
  }
}

/** 書きかけを残す。空になったら消す（空文字を抱え続けない）。 */
export function saveDraft(scope: string, body: string, store: DraftStore | null, now: number): void {
  if (!store) return;
  if (body.trim() === "") {
    clearDraft(scope, store);
    return;
  }
  try {
    store.setItem(draftKey(scope), JSON.stringify({ body, at: now }));
  } catch {
    // 容量切れなどで書けなくても、投稿は続けられる
  }
}

export function clearDraft(scope: string, store: DraftStore | null): void {
  if (!store) return;
  try {
    store.removeItem(draftKey(scope));
  } catch {
    // 消せなくても投稿は続けられる
  }
}
