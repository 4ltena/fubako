import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isMember } from "@/lib/timeline";
import { isVisibleTo } from "@/lib/visibility";

/**
 * 読み手が自分のためだけに、その投稿を伏せる／戻す。
 *
 * 書き手には何も届かない（通報ではない）。誰が何枚伏せたかはどこにも出さない。
 * reveal / react と同じ順で会員と可視性を確かめ、満たさなければ一律 404。
 * 自分の投稿は伏せられない（画面側の出し分けをサーバでも裏打ちする）。
 */
async function target(userId: string, id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, circleId: true, authorId: true, expiresAt: true, deletedAt: true },
  });
  if (!post || post.authorId === userId || !isVisibleTo(post, userId) || !(await isMember(userId, post.circleId))) return null;
  return post;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  if (!(await target(userId, id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.postVeil.upsert({ where: { userId_postId: { userId, postId: id } }, update: {}, create: { userId, postId: id } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  if (!(await target(userId, id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.postVeil.deleteMany({ where: { userId, postId: id } });
  return NextResponse.json({ ok: true });
}
