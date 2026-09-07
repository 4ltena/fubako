/**
 * 書きかけを端末に残す。
 *
 * 「準備時間が感情の寿命を超えると投稿が起きない」（企画書 1章）ので、画面を離れても
 * 本文・注意文・タグ・公開期間が消えないようにする。ただし催促はしない — 件数もバッジも「下書きがあります」も出さない。
 * ただ入っているだけ。
 *
 * 写真を除く入力内容だけを、読み手の端末（localStorage）に残す。サーバには送らない。
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

/** 書きかけを取り出す。無い・古い・壊れている場合は空の下書き。 */
export type DraftVisibility = "circle" | "private";
export type Draft = { body: string; cw: string; tags: string; days: number; visibility: DraftVisibility };
export const EMPTY_DRAFT: Draft = { body: "", cw: "", tags: "", days: 7, visibility: "circle" };

/** 以前の本文だけの形式も読める。 */
export function loadDraft(scope: string, store: DraftStore | null, now: number): Draft {
  if (!store) return { ...EMPTY_DRAFT };
  let raw: string | null = null;
  try {
    raw = store.getItem(draftKey(scope));
  } catch {
    return { ...EMPTY_DRAFT };
  }
  if (!raw) return { ...EMPTY_DRAFT };
  try {
    const saved = JSON.parse(raw) as Partial<Draft> & { body?: unknown; at?: unknown };
    if (typeof saved.body !== "string" || typeof saved.at !== "number") return { ...EMPTY_DRAFT };
    if (now - saved.at > DRAFT_TTL_MS) {
      clearDraft(scope, store);
      return { ...EMPTY_DRAFT };
    }
    // 旧形式には保存先がないため、これまでどおり箱への公開として復元する。
    // 明示されている値が壊れている場合は、意図せず公開しないよう自分だけの保存に倒す。
    const visibility: DraftVisibility = saved.visibility === undefined
      ? "circle"
      : saved.visibility === "circle" || saved.visibility === "private"
        ? saved.visibility
        : "private";
    return { body: saved.body, cw: typeof saved.cw === "string" ? saved.cw : "", tags: typeof saved.tags === "string" ? saved.tags : "", days: typeof saved.days === "number" && [1, 3, 7].includes(saved.days) ? saved.days : 7, visibility };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

/** 書きかけを残す。空になったら消す（空文字を抱え続けない）。 */
export function saveDraft(scope: string, draft: Draft, store: DraftStore | null, now: number): boolean {
  if (!store) return false;
  if (draft.body.trim() === "" && draft.cw.trim() === "" && draft.tags.trim() === "") {
    clearDraft(scope, store);
    return true;
  }
  try {
    store.setItem(draftKey(scope), JSON.stringify({ ...draft, at: now }));
    return true;
  } catch {
    return false;
  }
}

/** ブラウザ操作時の現在時刻で保存する小さな入口。 */
export function saveCurrentDraft(scope: string, draft: Draft, store: DraftStore | null): boolean {
  return saveDraft(scope, draft, store, Date.now());
}

export function clearDraft(scope: string, store: DraftStore | null): void {
  if (!store) return;
  try {
    store.removeItem(draftKey(scope));
  } catch {
    // 消せなくても投稿は続けられる
  }
}
