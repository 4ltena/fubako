/**
 * 今日の気配。「同じ場に誰かがいる」だけを伝える。
 *
 * - 人単位で見せない。誰が・何人・いつ は持たない（真偽値だけ）
 * - 粒度は「今日」まで。JST（Asia/Tokyo）で日付を切る
 * - 自分は数に入れない。自分しか来ていない日は何も出さない
 *
 * DB を触る側は lib/timeline.ts の seenAndPresence に置く。ここは純粋な判定だけ。
 */

/** 日本標準時は年間を通して UTC+9（夏時間が無い）。 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** lastSeenAt の更新間隔。連打で DB を叩かないための下限。暫定1時間。 */
export const SEEN_INTERVAL_MS = 60 * 60 * 1000;

export type SeenMember = { userId: string; lastSeenAt: Date | null };

/** JST での暦日（YYYY-MM-DD）。日付の境界はここだけで決める。 */
export function jstDayKey(at: Date): string {
  return new Date(at.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 前回から SEEN_INTERVAL_MS 以上経っていれば更新する。未設定なら必ず更新する。 */
export function shouldTouchSeen(lastSeenAt: Date | null, now: Date): boolean {
  if (lastSeenAt === null) return true;
  return now.getTime() - lastSeenAt.getTime() >= SEEN_INTERVAL_MS;
}

/** 自分以外に、JST で今日この場に来たメンバーが1人以上いるか。 */
export function presentToday(members: readonly SeenMember[], viewerId: string, now: Date): boolean {
  const today = jstDayKey(now);
  return members.some((m) => m.userId !== viewerId && m.lastSeenAt !== null && jstDayKey(m.lastSeenAt) === today);
}
