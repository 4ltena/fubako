import { notFound } from "next/navigation";
import { NewPostForm } from "@/components/NewPostForm";
import { SheetShell } from "@/components/SheetShell";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMember } from "@/lib/timeline";
import { suggestedTags } from "@/lib/tags";

/** タイムラインの上に紙を1枚置く。背後は暗幕で覆わず、薄くなるだけ。 */
export default async function SheetNewPost({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
  const userId = (await currentUserId())!;
  if (!(await isMember(userId, circleId))) notFound();
  const suggested = await suggestedTags(circleId);
  const circle = (await prisma.circle.findUnique({ where: { id: circleId }, select: { name: true } }))!;
  return (
    <SheetShell title={`${circle.name}へ`}>
      <NewPostForm circleId={circleId} suggested={suggested} draftKey={`${userId}:${circleId}`} afterPost="back" />
    </SheetShell>
  );
}
