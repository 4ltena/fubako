import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
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

export default async function TimelinePage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
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
        {posts.map((p) => (
          <PostCard key={p.id} post={p} wear={wearOf(new Date(p.createdAt), new Date(p.expiresAt), now)} />
        ))}
      </div>

      <details className="label mt-6 px-1 text-[11px] tracking-[0.14em] text-ink-faint">
        <summary>招待リンク</summary>
        <code className="mt-2 block select-all break-all rounded-[20px] bg-card p-3 tracking-normal">{inviteUrl}</code>
      </details>
    </div>
  );
}
