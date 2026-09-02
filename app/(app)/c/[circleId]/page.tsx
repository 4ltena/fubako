import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { timelineFor } from "@/lib/timeline";

export default async function TimelinePage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
  const userId = (await currentUserId())!;
  const posts = await timelineFor(userId, circleId);
  if (posts === null) notFound();
  const circle = (await prisma.circle.findUnique({ where: { id: circleId } }))!;
  const inviteUrl = `${process.env.APP_URL ?? ""}/join/${circle.inviteCode}`;
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">{circle.name}</h1>
        <Link href={`/c/${circleId}/new`} className="rounded bg-accent px-4 py-2 text-sm text-paper">投げる</Link>
      </div>
      <details className="text-xs text-ink-soft">
        <summary>招待リンク</summary>
        <code className="block select-all break-all rounded bg-card p-2">{inviteUrl}</code>
      </details>
      {posts.length === 0 && <p className="text-ink-soft text-sm">まだ何もありません。</p>}
      <ul className="space-y-3">
        {posts.map((p) => <li key={p.id}><PostCard post={p} /></li>)}
      </ul>
    </div>
  );
}
