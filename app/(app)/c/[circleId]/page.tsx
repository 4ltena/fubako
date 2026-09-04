import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PostList } from "@/components/PostList";
import { boxColor } from "@/lib/boxColor";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMember, seenAndPresentToday, timelineFor } from "@/lib/timeline";
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
  // 外枠に要るのは箱の名前と会員かどうかだけ。投稿は Suspense の中で後から流す。
  const [circle, member] = await Promise.all([prisma.circle.findUnique({ where: { id: circleId } }), isMember(userId, circleId)]);
  if (!circle || !member) notFound();
  const inviteUrl = `${process.env.APP_URL ?? ""}/join/${circle.inviteCode}`;
  const now = new Date();
  const color = boxColor(circle.inviteCode);
  return (
    <div>
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <h1 className="text-[20px] font-bold">{circle.name}</h1>
        <time className="mono ml-auto shrink-0 text-[11px] text-ink-faint">{dateLine(now)}</time>
        <Link href="/" className="label shrink-0 text-[11px] text-ink-faint underline underline-offset-4">べつの箱へ</Link>
      </header>

      <div className="mt-2">
        <Suspense fallback={<TimelineSkeleton />}>
          <Timeline userId={userId} circleId={circleId} now={now} />
        </Suspense>
      </div>

      <details className="label mt-6 text-[11px] text-ink-faint">
        <summary>この箱の言葉</summary>
        <div className="mt-2 space-y-3 border-t border-line pt-4">
          <p className="select-all text-lg tracking-[0.2em] text-ink">{circle.inviteCode}</p>
          <p className="label text-[11px] leading-[1.9]">この言葉をもらった人だけが入れます。リンクでも渡せます。</p>
          <code className="mono block select-all break-all text-[11px] text-ink-faint">{inviteUrl}</code>
          <form method="post" action="/api/circles/leave" className="flex items-center gap-2 border-t border-line pt-3">
            <input type="hidden" name="circleId" value={circleId} />
            <input name="word" required maxLength={60} placeholder="出るには、この言葉を書き写す" className="flex-1 bg-transparent text-[13px] tracking-normal placeholder:text-ink-faint focus:outline-none" />
            <button className="label shrink-0 rounded-full border border-line-2 px-4 py-2 text-[11px] text-ink-dim">この箱を出る</button>
          </form>
          <p className="label text-[11px] leading-[1.9]">
            {missedLeave ? "言葉が違います。出るのはやめておきました。" : "出ても、書いた紙はじぶんの箱に残ります。この言葉があれば、また入れます。"}
          </p>
        </div>
      </details>
    </div>
  );
}

/** 投稿と気配。外枠より後から流す（待つ間は骨組みだけ出す）。 */
async function Timeline({ userId, circleId, now }: { userId: string; circleId: string; now: Date }) {
  // 気配は真偽値だけ。人数も名前も時刻も持たない（README「数えない・急かさない」）。
  const [posts, presentToday] = await Promise.all([timelineFor(userId, circleId), seenAndPresentToday(userId, circleId)]);
  if (posts === null) notFound();
  return (
    <>
      {presentToday && (
        <p className="label border-b border-line py-3 text-[12px] text-ink-faint">今日、この場に来た人がいます</p>
      )}
      {posts.length === 0 && (
        <div className="flex flex-col gap-3 border-b border-line py-6">
          <p className="text-[15px] leading-[2.2] text-ink-dim">ここにはまだ何もありません。読まれないことを書いておく場所としても使えます。</p>
          <Link href={`/c/${circleId}/new`} className="label self-start rounded-full bg-ink px-6 py-3 text-xs tracking-[0.1em] text-paper">はじめに一通書く</Link>
        </div>
      )}
      <PostList
        posts={posts}
        circleId={circleId}
        wears={Object.fromEntries(posts.map((p) => [p.id, wearOf(new Date(p.createdAt), new Date(p.expiresAt), now)]))}
      />
    </>
  );
}

/** 読み込み中の骨組み。罫だけを 3 本置き、数も文字も出さない。 */
function TimelineSkeleton() {
  return (
    <div aria-busy="true" aria-label="読み込み中">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-b border-line py-5">
          <div className="h-3 w-24 rounded bg-veil" />
          <div className="mt-3 h-4 w-3/4 rounded bg-veil" />
        </div>
      ))}
    </div>
  );
}
