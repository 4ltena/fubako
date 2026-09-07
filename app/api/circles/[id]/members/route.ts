import { NextResponse } from "next/server";
import { done, fail, readBody, requireUser } from "@/lib/api";
import { isCircleAction, lockCircle, memberNames } from "@/lib/circles";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** 管理画面で必要な識別情報だけを返す。人数・活動・非表示語は返さない。 */
export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id: circleId } = await params;
  const [circle, membership] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId }, select: { createdById: true } }),
    prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } }),
  ]);
  if (!circle || circle.createdById !== userId || !membership) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [members, bans] = await Promise.all([
    prisma.membership.findMany({ where: { circleId }, select: { userId: true, user: { select: { name: true } } }, orderBy: { joinedAt: "asc" } }),
    prisma.circleBan.findMany({ where: { circleId }, select: { userId: true, user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({ members: memberNames(members), bans: memberNames(bans) }, { headers: { "cache-control": "private, no-store" } });
}

/** 参加取消は ban・会員削除・本人の公開中投稿の引き取りを同一トランザクションで行う。 */
export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id: circleId } = await params;
  const body = await readBody(req);
  const action = body.action ?? "";
  const targetUserId = body.targetUserId ?? "";
  if (!isCircleAction(action) || !targetUserId) return fail(req, `/c/${circleId}/manage`, 400, { error: "action" });
  const result = await prisma.$transaction(async (tx) => {
    if (!(await lockCircle(tx, circleId))) return "missing" as const;
    const [circle, managerMembership] = await Promise.all([
      tx.circle.findUnique({ where: { id: circleId }, select: { createdById: true } }),
      tx.membership.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } }),
    ]);
    if (!circle || circle.createdById !== userId || !managerMembership) return "missing" as const;
    if (targetUserId === userId && action !== "unban") return "invalid" as const;
    if (action === "unban") {
      const ban = await tx.circleBan.findUnique({ where: { circleId_userId: { circleId, userId: targetUserId } }, select: { userId: true } });
      if (!ban) return "missing" as const;
      await tx.circleBan.delete({ where: { circleId_userId: { circleId, userId: targetUserId } } });
      return "ok" as const;
    }
    const member = await tx.membership.findUnique({ where: { userId_circleId: { userId: targetUserId, circleId } }, select: { userId: true } });
    if (!member) return "missing" as const;
    const banned = await tx.circleBan.findUnique({ where: { circleId_userId: { circleId, userId: targetUserId } }, select: { userId: true } });
    if (action === "transfer") {
      if (banned) return "invalid" as const;
      await tx.circle.update({ where: { id: circleId }, data: { createdById: targetUserId } });
      return "ok" as const;
    }
    const now = new Date();
    await tx.circleBan.upsert({ where: { circleId_userId: { circleId, userId: targetUserId } }, create: { circleId, userId: targetUserId }, update: {} });
    await tx.membership.delete({ where: { userId_circleId: { userId: targetUserId, circleId } } });
    await tx.post.updateMany({ where: { circleId, authorId: targetUserId, visibility: "circle", deletedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } });
    return "ok" as const;
  });
  if (result === "missing") return fail(req, `/c/${circleId}/manage`, 404, { error: "not found" });
  if (result === "invalid") return fail(req, `/c/${circleId}/manage`, 409, { error: "invalid" });
  return done(req, `/c/${circleId}/manage`, { ok: true });
}
