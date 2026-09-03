import Link from "next/link";

/**
 * 広い画面の右の列（デザイン案 1e）。たよりの時刻と、宣言している語だけ。
 * 「右の列は宣言と次のたよりだけを持ち、流れを増やさない」（原本の注記）。
 */
export function RightRail({ words }: { words: string[] }) {
  return (
    <aside className="hidden w-[296px] shrink-0 flex-col gap-3 py-10 xl:flex">
      <div className="rounded-[26px] bg-sage px-[22px] py-6">
        <span className="label text-[11px] tracking-[0.2em] text-sage-ink">1日1回のたより</span>
        <p className="mt-3 text-[13px] leading-[2.15] text-sage-deep">
          次は今夜21時にまとめて渡します。それまで何も鳴りません。
        </p>
      </div>

      <div className="rounded-[26px] bg-card px-[22px] py-6 shadow-paper">
        <span className="label text-[11px] tracking-[0.2em] text-ink-soft">宣言している語</span>
        {words.length === 0 ? (
          <p className="mt-3 text-[13px] leading-[2.15] text-ink-faint">まだ何も宣言していません。</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {words.map((w) => (
              <span key={w} className="label rounded-full bg-veil px-3 py-[5px] text-[11px] tracking-[0.06em] text-ink-soft">{w}</span>
            ))}
          </div>
        )}
        <Link href="/settings/mutes" className="label mt-4 block text-[11px] tracking-[0.14em] text-accent">書き足す</Link>
      </div>
    </aside>
  );
}
