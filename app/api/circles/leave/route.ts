import { NextResponse } from "next/server";
import { done, fail, readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { lockCircle, mayLeaveCircle } from "@/lib/circles";

/**
 * 箱を出る。
 *
 * 出たことは誰にも知らせない。書いた紙は自分の箱に残る（Post は消さない）。
 * 退出は招待語に依存させない。画面上の確認を経て、本人が選べば公開中の紙を引き取る。
 */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const b = await readBody(req);
  const circleId = b.circleId ?? "";
  const withdrawn = b.withdraw === "true";
  const outcome = await prisma.$transaction(async (tx) => {
    if (!(await lockCircle(tx, circleId))) return "missing" as const;
    const [circle, membership, count] = await Promise.all([
      tx.circle.findUnique({ where: { id: circleId }, select: { createdById: true } }),
      tx.membership.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } }),
      tx.membership.count({ where: { circleId } }),
    ]);
    if (!circle || !membership) return "missing" as const;
    if (!mayLeaveCircle(circle.createdById === userId, count)) return "transfer" as const;
    const now = new Date();
    if (withdrawn) await tx.post.updateMany({ where: { circleId, authorId: userId, visibility: "circle", deletedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } });
    await tx.membership.delete({ where: { userId_circleId: { userId, circleId } } });
    if (count === 1) await tx.circle.update({ where: { id: circleId }, data: { invitesEnabled: false } });
    return "left" as const;
  });
  if (outcome === "missing") return fail(req, "/", 404, { error: "not found" });
  if (outcome === "transfer") return fail(req, `/c/${circleId}?leave=transfer`, 409, { error: "transfer required" });
  return done(req, "/", { ok: true });
}
