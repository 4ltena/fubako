import { NextResponse } from "next/server";
import { done, readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { inviteCode } = await readBody(req);
  const circle = await prisma.circle.findUnique({
    where: { inviteCode: inviteCode ?? "" },
    include: { _count: { select: { memberships: true } } },
  });
  // 存在しないコードと定員超過は同じ 404。コードの当たり外れを教えない。
  if (!circle) return NextResponse.json({ error: "not found" }, { status: 404 });
  const already = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId: circle.id } } });
  if (!already) {
    if (circle._count.memberships >= circle.memberLimit) return NextResponse.json({ error: "full" }, { status: 404 });
    // ponytail: 定員チェックとinsertが非原子。30人規模の競合は無視する
    await prisma.membership.create({ data: { userId, circleId: circle.id } });
  }
  return done(req, `/c/${circle.id}`, { id: circle.id });
}
