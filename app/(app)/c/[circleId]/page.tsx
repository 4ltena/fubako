import Link from "next/link";
import { notFound } from "next/navigation";
import { PostList } from "@/components/PostList";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { seenAndPresentToday, timelineFor } from "@/lib/timeline";
import { wearOf } from "@/lib/wear";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const KANJI = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

/** 「九月三日　水曜」。日付は読み物として置くだけで、数は数えない。 */
function dateLine(d: Date): string {
  const kanji = (n: number) => (n <= 10 ? KANJI[n] : n < 20 ? `十${n % 10 === 0 ? "" : KANJI[n % 10]}` : `${KANJI[Math.floor(n / 10)]}十${n % 10 === 0 ? "" : KANJI[n % 10]}`);
  return `${kanji(d.getMonth() + 1)}月${kanji(d.getDate())}日　${WEEKDAYS[d.getDay()]}曜`;
}

export default async function TimelinePage({ params, searchParams }: { params: Promise<{ circleId: string }>; searchParams: Promise<{ leave?: string }> }) {
  const { circleId } = await params;
  const missedLeave = (await searchParams).leave === "miss";
  const userId = (await currentUserId())!;
  const posts = await timelineFor(userId, circleId);
  if (posts === null) notFound();
  // 気配は真偽値だけ。人数も名前も時刻も持たない（README「数えない・急かさない」）。
  const presentToday = await seenAndPresentToday(userId, circleId);
  const circle = (await prisma.circle.findUnique({ where: { id: circleId } }))!;
  const inviteUrl = `${process.env.APP_URL ?? ""}/join/${circle.inviteCode}`;
  const now = new Date();
  return (
    <div>
      <header className="flex flex-col gap-1.5 px-1">
        <span className="label text-[11px] tracking-[0.2em] text-ink-soft">{dateLine(now)}</span>
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl tracking-[0.14em]">{circle.name}</h1>
          <Link href="/" className="label ml-auto text-[11px] tracking-[0.14em] text-accent">べつの箱へ</Link>
        </div>
      </header>

      <div className="mt-5 space-y-3">
        {presentToday && (
          <p className="label rounded-full bg-sage px-5 py-3 text-[13px] tracking-[0.06em] text-sage-deep">今日、この場に来た人がいます</p>
        )}
        {posts.length === 0 && <p className="px-1 text-sm leading-[2.1] text-ink-soft">ここにはまだ何もありません。読まれないことを書いておく場所としても使えます。</p>}
        <PostList posts={posts} wears={Object.fromEntries(posts.map((p) => [p.id, wearOf(new Date(p.createdAt), new Date(p.expiresAt), now)]))} />
      </div>

      <details className="label mt-6 px-1 text-[11px] tracking-[0.14em] text-ink-faint">
        <summary>この箱の言葉</summary>
        <div className="mt-2 space-y-3 rounded-[20px] bg-card p-4 tracking-normal">
          <p className="select-all text-lg tracking-[0.2em] text-ink">{circle.inviteCode}</p>
          <p className="label text-[11px] leading-[1.9] tracking-[0.08em]">この言葉をもらった人だけが入れます。リンクでも渡せます。</p>
          <code className="block select-all break-all text-[11px] text-ink-faint">{inviteUrl}</code>
          <form method="post" action="/api/circles/leave" className="flex items-center gap-2 border-t border-line pt-3">
            <input type="hidden" name="circleId" value={circleId} />
            <input name="word" required maxLength={60} placeholder="出るには、この言葉を書き写す" className="flex-1 bg-transparent text-[13px] tracking-normal placeholder:text-ink-pale focus:outline-none" />
            <button className="label shrink-0 rounded-full bg-veil px-4 py-2 text-[11px] tracking-[0.14em] text-ink-soft">この箱を出る</button>
          </form>
          <p className="label text-[11px] leading-[1.9] tracking-[0.08em]">
            {missedLeave ? "言葉が違います。出るのはやめておきました。" : "出ても、書いた紙はじぶんの箱に残ります。この言葉があれば、また入れます。"}
          </p>
        </div>
      </details>
    </div>
  );
}
