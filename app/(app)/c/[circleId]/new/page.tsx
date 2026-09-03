import Link from "next/link";
import { notFound } from "next/navigation";
import { NewPostForm } from "@/components/NewPostForm";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMember } from "@/lib/timeline";

export default async function NewPostPage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
  const userId = (await currentUserId())!;
  if (!(await isMember(userId, circleId))) notFound();
  // そのサークルでよく使われた語をサジェスト（固定タグ体系は作らない）
  const recent = await prisma.post.findMany({ where: { circleId, deletedAt: null, expiresAt: { gt: new Date() } }, select: { tags: true }, orderBy: { createdAt: "desc" }, take: 200 });
  const freq = new Map<string, number>();
  for (const t of recent.flatMap((p) => p.tags)) freq.set(t, (freq.get(t) ?? 0) + 1);
  const suggested = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  const circle = (await prisma.circle.findUnique({ where: { id: circleId }, select: { name: true } }))!;
  return (
    <div>
      <div className="mb-5 flex items-center justify-between px-1">
        <Link href={`/c/${circleId}`} className="label text-xs tracking-[0.16em] text-ink-faint">とじる</Link>
        <span className="text-[15px] tracking-[0.14em]">{circle.name}へ</span>
        <span className="label invisible text-xs">とじる</span>
      </div>
      {/* 書きかけの鍵は人ごとに分ける。同じ端末を別の人が使っても混ざらない */}
      <NewPostForm circleId={circleId} suggested={suggested} draftKey={`${userId}:${circleId}`} />
    </div>
  );
}
