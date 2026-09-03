import { NextResponse } from "next/server";
import { done, fail, readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizeInvite } from "@/lib/invite";

/**
 * 箱を出る。
 *
 * 出たことは誰にも知らせない。書いた紙は自分の箱に残る（Post は消さない）。
 * 出るには、その箱の招待の言葉を書き写してもらう。控えを取った人だけが出られるので、
 * 「出たあと二度と戻れない」事故が起きない（出た瞬間、その箱は外からは見えなくなる）。
 */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const b = await readBody(req);
  const circleId = b.circleId ?? "";
  const membership = await prisma.membership.findUnique({
    where: { userId_circleId: { userId, circleId } },
    select: { circle: { select: { inviteCode: true } } },
  });
  if (!membership) return fail(req, "/", 404, { error: "not found" });
  if (normalizeInvite(b.word ?? "") !== membership.circle.inviteCode) {
    return fail(req, `/c/${circleId}?leave=miss`, 400, { error: "word" });
  }
  await prisma.membership.delete({ where: { userId_circleId: { userId, circleId } } });
  return done(req, "/", { ok: true });
}
