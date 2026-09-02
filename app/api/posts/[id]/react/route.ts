import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isMember } from "@/lib/timeline";
import { isVisibleTo } from "@/lib/visibility";

/** 反応は1種類。押すたびに付け外し。数はどこにも返さない。 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || !(await isMember(userId, post.circleId)) || !isVisibleTo(post, userId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const key = { postId_userId: { postId: id, userId } };
  const existing = await prisma.reaction.findUnique({ where: key });
  if (existing) await prisma.reaction.delete({ where: key });
  else await prisma.reaction.create({ data: { postId: id, userId } });
  return NextResponse.json({ reacted: !existing });
}
