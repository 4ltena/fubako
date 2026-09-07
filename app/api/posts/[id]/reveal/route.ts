import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isMember } from "@/lib/timeline";
import { isVisibleTo } from "@/lib/visibility";
import { issueImageGrant } from "@/lib/image-grant";

/** 伏せた投稿の本文。読み手が自分でタップしたときだけ返す。 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { images: { orderBy: { createdAt: "asc" }, select: { id: true } } },
  });
  if (!post || !isVisibleTo(post, userId) || (post.authorId !== userId && !(await isMember(userId, post.circleId)))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const imageGrant = issueImageGrant(userId, post.id);
  if (!imageGrant) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json(
    { body: post.body, imageIds: post.images.map((i) => i.id), imageGrant, ...(post.cw ? { cw: post.cw } : {}) },
    { headers: { "cache-control": "private, no-store" } },
  );
}
