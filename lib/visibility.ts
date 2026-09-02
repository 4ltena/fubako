/**
 * 寿命と可視性の判定。
 *
 * - 投稿は expiresAt を過ぎると他のメンバーから見えない
 * - 書いた本人には期限切れでも見える（アーカイブ）
 * - 削除済みは本人にも見えない
 * - 寿命は短くする方向にだけ変更できる
 */

export const DEFAULT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 暫定7日、未検証

export interface VisibilityInput {
  authorId: string;
  expiresAt: Date;
  deletedAt: Date | null;
}

export function defaultExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + DEFAULT_LIFETIME_MS);
}

export function isVisibleTo(post: VisibilityInput, viewerId: string, now: Date = new Date()): boolean {
  if (post.deletedAt) return false;
  if (post.authorId === viewerId) return true;
  return now.getTime() < post.expiresAt.getTime();
}

/**
 * 寿命の変更要求を受け付ける。短くする場合だけ新しい値を返し、
 * 伸ばそうとした場合は現在値をそのまま返す。
 */
export function shortenExpiry(current: Date, requested: Date): Date {
  return requested.getTime() < current.getTime() ? requested : current;
}
