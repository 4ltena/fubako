import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { isMember } from "@/lib/timeline";
import { isVisibleTo } from "@/lib/visibility";

/**
 * 画像本体。投稿が読み手に可視で、かつ会員か書いた本人のときだけ Blob を代理で返す。
 * 公開 URL は無い。箱を出たあとも、自分が書いた紙はじぶんの箱に残るので本人には返す。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const image = await prisma.image.findUnique({ where: { id }, include: { post: true } });
  const allowed = image !== null && isVisibleTo(image.post, userId) && (image.post.authorId === userId || (await isMember(userId, image.post.circleId)));
  if (!allowed) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const stream = await getObject(image.key);
  if (!stream) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new Response(stream, {
    headers: {
      "content-type": "image/webp",
      "cache-control": "private, max-age=3600",
      "x-robots-tag": "noindex",
    },
  });
}
