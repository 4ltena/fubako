import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isVisibleTo } from "@/lib/visibility";

/** 反応は1種類。押すたびに付け外し。数はどこにも返さない。 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  // 箱行をロックする前の読取は、ロック対象を知るための circleId だけに限る。
  const target = await prisma.post.findUnique({ where: { id }, select: { circleId: true } });
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const reacted = await prisma.$transaction(async (tx) => {
    // 参加取消・退出と同じ箱行を直列化する。取消後の新規反応を作らない。
    const circles = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Circle" WHERE "id" = ${target.circleId} FOR UPDATE`;
    if (circles.length === 0) return null;
    const [post, membership] = await Promise.all([
      tx.post.findUnique({ where: { id } }),
      tx.membership.findUnique({ where: { userId_circleId: { userId, circleId: target.circleId } } }),
    ]);
    if (!post || !membership || post.circleId !== target.circleId || post.authorId === userId || !isVisibleTo(post, userId)) return null;
    const key = { postId_userId: { postId: id, userId } };
    const existing = await tx.reaction.findUnique({ where: key });
    if (existing) {
      await tx.reaction.delete({ where: key });
      return false;
    }
    await tx.reaction.create({ data: { postId: id, userId } });
    return true;
  });
  if (reacted === null) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ reacted });
}
