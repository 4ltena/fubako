/**
 * 紙のいたみ。寿命の残りを、数字ではなく紙の状態で見せる（「カードの寿命」案）。
 *
 * 「あと何日」は出さない。外に出ていた分だけ、しわ・雨の跡・角の折れが増える。
 * 判定に使うのは createdAt と expiresAt だけで、新しい情報は持たない。
 */

/** 0=おろしたて 〜 4=もどる直前 */
export type Wear = 0 | 1 | 2 | 3 | 4;

export const WEAR_STEPS = 4;

export function wearOf(createdAt: Date, expiresAt: Date, now: Date = new Date()): Wear {
  const span = expiresAt.getTime() - createdAt.getTime();
  if (span <= 0) return WEAR_STEPS;
  const elapsed = (now.getTime() - createdAt.getTime()) / span;
  if (elapsed <= 0) return 0;
  if (elapsed >= 1) return WEAR_STEPS;
  return (Math.floor(elapsed * WEAR_STEPS) + 1) as Wear;
}
