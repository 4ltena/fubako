import { NextResponse } from "next/server";
import { done, fail, readBody, requireUser } from "@/lib/api";
import { lockCircle } from "@/lib/circles";
import { prisma } from "@/lib/db";

/** 本人の一覧だけからしまう。所属も投稿の公開状態も変えない。 */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const body = await readBody(req);
  const circleId = body.circleId ?? "";
  const archived = body.archived === "true";
  const changed = await prisma.$transaction(async (tx) => {
    if (!(await lockCircle(tx, circleId))) return false;
    const membership = await tx.membership.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } });
    if (!membership) return false;
    await tx.membership.update({ where: { userId_circleId: { userId, circleId } }, data: { archivedAt: archived ? new Date() : null } });
    return true;
  });
  if (!changed) return fail(req, "/", 404, { error: "not found" });
  return done(req, "/", { archived });
}
