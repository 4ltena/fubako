import { NextResponse } from "next/server";
import { done, fail, readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizeInvite } from "@/lib/invite";
import { lockCircle } from "@/lib/circles";

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const b = await readBody(req);
  // 打ち間違い以外の揺れ（カタカナ・空白）だけを均す。大小は潰さない
  const inviteCode = normalizeInvite(b.inviteCode ?? "");
  // form から来たときの戻り先。外に飛ばされないよう、自分の中のパスだけを許す
  const asked = b.from ?? "/";
  const from = asked.startsWith("/") && !asked.startsWith("//") && !asked.startsWith("/\\") ? asked : "/";
  const circle = await prisma.circle.findUnique({ where: { inviteCode }, select: { id: true } });
  // 存在しないコードと定員超過は同じ扱い。コードの当たり外れを教えない。
  const miss = `${from}${from.includes("?") ? "&" : "?"}join=miss`;
  if (!circle) return fail(req, miss, 404, { error: "not found" });
  const joined = await prisma.$transaction(async (tx) => {
    if (!(await lockCircle(tx, circle.id))) return null;
    // ロック後の招待語・停止・禁止・定員を必ず読み直す。
    const current = await tx.circle.findUnique({
      where: { id: circle.id },
      select: { id: true, inviteCode: true, invitesEnabled: true, memberLimit: true, _count: { select: { memberships: true } } },
    });
    if (!current || current.inviteCode !== inviteCode || !current.invitesEnabled) return null;
    const [already, banned] = await Promise.all([
      tx.membership.findUnique({ where: { userId_circleId: { userId, circleId: current.id } }, select: { userId: true } }),
      tx.circleBan.findUnique({ where: { circleId_userId: { circleId: current.id, userId } }, select: { userId: true } }),
    ]);
    if (already) return current.id;
    if (banned || current._count.memberships >= current.memberLimit) return null;
    await tx.membership.create({ data: { userId, circleId: current.id } });
    return current.id;
  });
  if (!joined) return fail(req, miss, 404, { error: "not found" });
  return done(req, `/c/${joined}`, { id: joined });
}
