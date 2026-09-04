import Link from "next/link";
import { notFound } from "next/navigation";
import { NewPostForm } from "@/components/NewPostForm";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMember } from "@/lib/timeline";
import { suggestedTags } from "@/lib/tags";

export default async function NewPostPage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
  const userId = (await currentUserId())!;
  if (!(await isMember(userId, circleId))) notFound();
  const suggested = await suggestedTags(circleId);
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
