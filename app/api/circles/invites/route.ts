import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { done, fail, readBody, requireUser } from "@/lib/api";
import { lockCircle } from "@/lib/circles";
import { prisma } from "@/lib/db";
import { makeInvite } from "@/lib/invite";

async function unusedInvite(tx: Parameters<typeof prisma.$transaction>[0] extends (arg: infer T) => unknown ? T : never) {
  for (let i = 0; i < 5; i++) {
    const inviteCode = makeInvite((max) => randomInt(max));
    if (!(await tx.circle.findUnique({ where: { inviteCode }, select: { id: true } }))) return inviteCode;
  }
  throw new Error("invite collision");
}

/** 管理者だけが招待を停止し、必要なときは以前の言葉を無効にして作り直す。 */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const body = await readBody(req);
  const circleId = body.circleId ?? "";
  const action = body.action;
  if (action !== "disable" && action !== "regenerate") return NextResponse.json({ error: "action" }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    if (!(await lockCircle(tx, circleId))) return null;
    const [circle, membership] = await Promise.all([
      tx.circle.findUnique({ where: { id: circleId }, select: { createdById: true } }),
      tx.membership.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } }),
    ]);
    if (!circle || circle.createdById !== userId || !membership) return null;
    if (action === "disable") {
      await tx.circle.update({ where: { id: circleId }, data: { invitesEnabled: false } });
      return { inviteCode: null, invitesEnabled: false };
    }
    const inviteCode = await unusedInvite(tx);
    await tx.circle.update({ where: { id: circleId }, data: { inviteCode, invitesEnabled: true } });
    return { inviteCode, invitesEnabled: true };
  });
  if (!result) return fail(req, `/c/${circleId}`, 404, { error: "not found" });
  return done(req, `/c/${circleId}/manage`, result);
}
