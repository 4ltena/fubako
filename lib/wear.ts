/**
 * 紙のいたみ。寿命の残りを、数字ではなく紙の状態で見せる（「カードの寿命」案）。
 *
 * 三つだけ守る。
 * - 外に出ていた日数だけ進む（長く出ているほどいたむ）
 * - 手元にもどったら止まる（引き取った時点のまま残る）
 * - いたみ方は紙ごとに違うが、同じ紙はいつ見ても同じ（投稿 ID から決める。乱数は使わない）
 */

/** ここまで出ていると、いたみ切る。既定の寿命と同じ7日。 */
export const FULL_WEAR_MS = 7 * 24 * 60 * 60 * 1000;

/** 何番目のシミが、どのくらいいたんだら出てくるか。 */
const STAIN_AT = [0.18, 0.42, 0.66];
/** 角が折れはじめるところ。 */
const FOLD_AT = 0.55;

/**
 * いたみ具合 0〜1。
 * 数え始めは投げた時刻、数え終わりは「今」か「みんなから見えなくなった時刻」の早いほう。
 * 寿命を縮めて引き取った紙は、その時点のいたみのまま止まる。
 */
export function wearOf(createdAt: Date, expiresAt: Date, now: Date = new Date()): number {
  const until = Math.min(now.getTime(), expiresAt.getTime());
  const outside = until - createdAt.getTime();
  if (outside <= 0) return 0;
  return Math.min(1, outside / FULL_WEAR_MS);
}

/** 文字列から決まる数の並び。同じ ID なら毎回同じ値を返す。 */
function* numbers(id: string): Generator<number> {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  for (;;) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    yield ((h >>> 0) % 10000) / 10000;
  }
}

export type PaperMarks = {
  /** じぶんの箱で重ねたときの傾き（度）。 */
  tilt: number;
  /** しわ。角度と位置。 */
  creases: { angle: number; at: number }[];
  /** シミ。位置と大きさ。 */
  stains: { x: number; y: number; rx: number; ry: number }[];
  /** 折れる角（左右どちらか）。 */
  foldRight: boolean;
};

/** その紙だけのいたみ方。ID から決まるので、いつ見ても同じ場所に同じシミが出る。 */
export function marksOf(id: string): PaperMarks {
  const r = numbers(id);
  const next = () => r.next().value;
  return {
    tilt: (next() - 0.5) * 1.6,
    creases: [
      { angle: 96 + next() * 18, at: 32 + next() * 22 },
      { angle: 68 + next() * 16, at: 52 + next() * 26 },
    ],
    stains: STAIN_AT.map(() => ({
      x: 12 + next() * 76,
      y: 24 + next() * 64,
      rx: 30 + next() * 46,
      ry: 22 + next() * 34,
    })),
    foldRight: next() < 0.5,
  };
}

/** 紙の面に重ねる模様。wear が進むほど濃く、増える。 */
export function paperTexture(id: string, wear: number): string {
  if (wear <= 0) return "none";
  const marks = marksOf(id);
  const crease = 0.010 + wear * 0.022;
  const layers = marks.creases.map(
    (c, i) =>
      `linear-gradient(${c.angle.toFixed(1)}deg, transparent ${(c.at - 14).toFixed(1)}%, rgba(32,30,29,${(crease * (i === 0 ? 1 : 0.8)).toFixed(4)}) ${c.at.toFixed(1)}%, transparent ${(c.at + 14).toFixed(1)}%)`,
  );
  marks.stains.forEach((s, i) => {
    if (wear <= STAIN_AT[i]) return;
    // 出はじめは薄く、時間が経つほど濃くなる
    const age = (wear - STAIN_AT[i]) / (1 - STAIN_AT[i]);
    const alpha = (0.030 + age * 0.055).toFixed(4);
    layers.push(`radial-gradient(${s.rx.toFixed(0)}px ${s.ry.toFixed(0)}px at ${s.x.toFixed(0)}% ${s.y.toFixed(0)}%, rgba(100,92,80,${alpha}) 0%, transparent 72%)`);
  });
  return layers.join(",");
}

/** 折れた角を出すか。 */
export function isFolded(wear: number): boolean {
  return wear > FOLD_AT;
}
