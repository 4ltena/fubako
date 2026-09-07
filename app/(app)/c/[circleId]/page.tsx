import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TopicMuteControls } from "@/components/TopicMuteControls";
import { PostList } from "@/components/PostList";
import { boxColor } from "@/lib/boxColor";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { muteWordsOf, seenAndPresentToday, timelineFor } from "@/lib/timeline";
import { wearOf } from "@/lib/wear";
import { CircleArchiveButton } from "@/components/CircleArchiveButton";
import { CircleLeaveForm } from "@/components/CircleLeaveForm";
import { jstDateLine } from "@/lib/stamp";

export default async function TimelinePage({ params, searchParams }: { params: Promise<{ circleId: string }>; searchParams: Promise<{ leave?: string }> }) {
  const { circleId } = await params;
  const transferRequired = (await searchParams).leave === "transfer";
  const userId = (await currentUserId())!;
  // 外枠に要るのは箱の名前と会員かどうかだけ。投稿は Suspense の中で後から流す。
  const [circle, membership] = await Promise.all([prisma.circle.findUnique({ where: { id: circleId } }), prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } } })]);
  if (!circle || !membership) notFound();
  const inviteUrl = `${process.env.APP_URL ?? ""}/join/${circle.inviteCode}`;
  const topicRules = await prisma.topicMute.findMany({ where: { userId, circleId }, select: { id: true, word: true }, orderBy: { createdAt: "asc" } });
  const now = new Date();
  const color = boxColor(circle.inviteCode);
  return (
    <div>
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <h1 className="text-[20px] font-bold">{circle.name}</h1>
        <time className="mono ml-auto shrink-0 text-[11px] text-ink-faint">{jstDateLine(now)}</time>
        <Link href="/" className="label flex min-h-11 shrink-0 items-center text-[11px] text-ink-faint underline underline-offset-4">べつの箱へ</Link>
      </header>

      {circle.description && <section className="border-b border-line py-4"><h2 className="label text-[11px] text-ink-faint">この箱について</h2><p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-ink-dim">{circle.description}</p></section>}

      <details className="mt-4"><summary className="label flex min-h-11 cursor-pointer items-center text-[12px] text-ink-dim">見るまで伏せる</summary><TopicMuteControls circleId={circleId} initialRules={topicRules} /></details>
      <div className="mt-2">
        <Suspense fallback={<TimelineSkeleton />}>
          <Timeline userId={userId} circleId={circleId} now={now} />
        </Suspense>
      </div>

      <details className="label mt-6 text-[11px] text-ink-faint">
        <summary className="flex min-h-11 cursor-pointer items-center">この箱の言葉</summary>
        <div className="mt-2 space-y-3 border-t border-line pt-4">
          <p className="select-all text-lg tracking-[0.2em] text-ink">{circle.inviteCode}</p>
          <p className="label text-[11px] leading-[1.9]">この言葉をもらった人だけが入れます。リンクでも渡せます。</p>
          <code className="mono block select-all break-all text-[11px] text-ink-faint">{inviteUrl}</code>
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <CircleArchiveButton circleId={circleId} archived={membership.archivedAt !== null} />
            {circle.createdById === userId && <Link href={`/c/${circleId}/manage`} className="label flex min-h-11 items-center rounded-full border border-line-2 px-4 py-2 text-[11px] text-ink-dim">この箱を整える</Link>}
          </div>
          <CircleLeaveForm circleId={circleId} transferRequired={transferRequired} />
        </div>
      </details>
    </div>
  );
}

/** 投稿と気配。外枠より後から流す（待つ間は骨組みだけ出す）。 */
async function Timeline({ userId, circleId, now }: { userId: string; circleId: string; now: Date }) {
  // 気配は真偽値だけ。人数も名前も時刻も持たない（README「数えない・急かさない」）。
  const [posts, presentToday, muteWords] = await Promise.all([timelineFor(userId, circleId), seenAndPresentToday(userId, circleId), muteWordsOf(userId, circleId)]);
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
        key={JSON.stringify(muteWords)}
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
