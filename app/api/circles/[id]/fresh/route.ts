import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isMember } from "@/lib/timeline";
import { muteWordsOf } from "@/lib/timeline";
import { veilFor } from "@/lib/veil";

/**
 * その時刻より後に、自分以外の紙が置かれたか。
 *
 * 返すのは真偽値だけ。何枚あるか・誰が置いたかは返さない（README「数えない」）。
 * 呼ぶのは読み手の画面が前面のときだけで、並びを変えるのは読み手が「読みこむ」を
 * 押したときに限る（自動で流し込むと急かしになる）。
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  if (!(await isMember(userId, id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const since = new Date(new URL(req.url).searchParams.get("since") ?? "");
  if (Number.isNaN(since.getTime())) return NextResponse.json({ error: "since" }, { status: 400 });
  const now = new Date();
  const [posts, muteWords] = await Promise.all([
    prisma.post.findMany({
      where: { circleId: id, visibility: "circle", deletedAt: null, expiresAt: { gt: now }, createdAt: { gt: since }, NOT: { authorId: userId } },
      select: { body: true, cw: true, tags: true, veils: { where: { userId }, select: { userId: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    muteWordsOf(userId, id),
  ]);
  const fresh = posts.some((post) => !veilFor({ body: post.body, cw: post.cw, tags: post.tags }, muteWords, { selfVeiled: post.veils.length > 0 }).veiled);
  return NextResponse.json({ fresh });
}
