import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { isMember } from "@/lib/timeline";
import { isVisibleTo } from "@/lib/visibility";
import { muteWordsOf } from "@/lib/timeline";
import { veilFor } from "@/lib/veil";
import { verifyImageGrant } from "@/lib/image-grant";

/**
 * 画像本体。投稿が読み手に可視で、かつ会員か書いた本人のときだけ Blob を代理で返す。
 * 公開 URL は無い。箱を出たあとも、自分が書いた紙はじぶんの箱に残るので本人には返す。
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const image = await prisma.image.findUnique({
    where: { id },
    include: { post: { include: { veils: { where: { userId }, select: { userId: true } } } } },
  });
  if (!image || !isVisibleTo(image.post, userId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const ownPost = image.post.authorId === userId;
  const grant = verifyImageGrant(new URL(req.url).searchParams.get("grant"), userId, image.postId);
  const unveiled = ownPost
    ? true
    : !veilFor(
        { body: image.post.body, cw: image.post.cw, tags: image.post.tags },
        await muteWordsOf(userId, image.post.circleId),
        { selfVeiled: image.post.veils.length > 0 },
      ).veiled;
  const allowed = ownPost || ((await isMember(userId, image.post.circleId)) && (unveiled || grant));
  if (!allowed) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const stream = await getObject(image.key);
  if (!stream) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new Response(stream, {
    headers: {
      "content-type": "image/webp",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
