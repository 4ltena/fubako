import { NextResponse } from "next/server";
import { done, fail, readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizeInvite } from "@/lib/invite";

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const b = await readBody(req);
  // 打ち間違い以外の揺れ（カタカナ・空白）だけを均す。大小は潰さない
  const inviteCode = normalizeInvite(b.inviteCode ?? "");
  // form から来たときの戻り先。無ければサークル一覧
  const from = (b.from ?? "/").startsWith("/") ? (b.from ?? "/") : "/";
  const circle = await prisma.circle.findUnique({
    where: { inviteCode },
    include: { _count: { select: { memberships: true } } },
  });
  // 存在しないコードと定員超過は同じ扱い。コードの当たり外れを教えない。
  const miss = `${from}${from.includes("?") ? "&" : "?"}join=miss`;
  if (!circle) return fail(req, miss, 404, { error: "not found" });
  const already = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId: circle.id } } });
  if (!already) {
    if (circle._count.memberships >= circle.memberLimit) return fail(req, miss, 404, { error: "not found" });
    // ponytail: 定員チェックとinsertが非原子。30人規模の競合は無視する
    await prisma.membership.create({ data: { userId, circleId: circle.id } });
  }
  return done(req, `/c/${circle.id}`, { id: circle.id });
}
