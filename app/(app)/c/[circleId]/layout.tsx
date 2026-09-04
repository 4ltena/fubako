/**
 * サークルの器。@sheet は「投げる」を重ねて出すための枠（デザイン案 1f）。
 * タイムラインから押したときだけ重なり、直接ひらいた・再読み込みしたときは
 * 1枚の画面として出る（default.tsx が何も描かない）。
 */
export default function CircleLayout({ children, sheet }: { children: React.ReactNode; sheet: React.ReactNode }) {
  return (
    <>
      {children}
      {sheet}
    </>
  );
}
