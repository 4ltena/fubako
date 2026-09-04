import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isMember } from "@/lib/timeline";

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
  const one = await prisma.post.findFirst({
    where: { circleId: id, deletedAt: null, expiresAt: { gt: now }, createdAt: { gt: since }, NOT: { authorId: userId } },
    select: { id: true },
  });
  return NextResponse.json({ fresh: one !== null });
}
