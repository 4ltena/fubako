import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { validateCircleDescription } from "@/lib/circle-description";
import { lockCircle } from "@/lib/circles";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const privateHeaders = { "cache-control": "private, no-store" };

/** 会員にだけ箱の説明を返す。招待前の画面から説明を推測させない。 */
export async function GET(_request: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id: circleId } = await params;
  const membership = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } });
  if (!membership) return NextResponse.json({ error: "not found" }, { status: 404 });
  const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { description: true } });
  if (!circle) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ description: circle.description }, { headers: privateHeaders });
}

/** 更新の直前に箱をロックし、管理者かつ会員であることを読み直す。 */
export async function PUT(request: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id: circleId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "description" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "description" }, { status: 400 });
  const checked = validateCircleDescription((body as { description?: unknown }).description);
  if (!checked.ok) return NextResponse.json({ error: "description" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    if (!(await lockCircle(tx, circleId))) return "missing" as const;
    const [circle, membership] = await Promise.all([
      tx.circle.findUnique({ where: { id: circleId }, select: { createdById: true } }),
      tx.membership.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } }),
    ]);
    if (!circle || !membership || circle.createdById !== userId) return "missing" as const;
    await tx.circle.update({ where: { id: circleId }, data: { description: checked.description } });
    return "ok" as const;
  });
  if (result === "missing") return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ description: checked.description }, { headers: privateHeaders });
}
