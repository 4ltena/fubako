import Link from "next/link";
import { notFound } from "next/navigation";
import { NewPostForm } from "@/components/NewPostForm";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { declaredWordsFor, isMember } from "@/lib/timeline";
import { suggestedTags } from "@/lib/tags";

export default async function NewPostPage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
  const userId = (await currentUserId())!;
  if (!(await isMember(userId, circleId))) notFound();
  const [suggested, declaredWords] = await Promise.all([suggestedTags(circleId), declaredWordsFor(circleId)]);
  const circle = (await prisma.circle.findUnique({ where: { id: circleId }, select: { name: true } }))!;
  return (
    <div>
      <div className="mb-5 flex items-center justify-between border-b border-line pb-4">
        <Link href={`/c/${circleId}`} className="label text-xs text-ink-faint underline underline-offset-4">とじる</Link>
        <span className="text-[15px]">{circle.name}へ</span>
        <span className="label invisible text-xs">とじる</span>
      </div>
      {/* 書きかけの鍵は人ごとに分ける。同じ端末を別の人が使っても混ざらない */}
      <NewPostForm circleId={circleId} suggested={suggested} declaredWords={declaredWords} draftKey={`${userId}:${circleId}`} />
    </div>
  );
}
