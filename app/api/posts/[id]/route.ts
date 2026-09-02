import { NextResponse } from "next/server";
import { readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { shortenExpiry } from "@/lib/visibility";

type Ctx = { params: Promise<{ id: string }> };

/** 寿命を短くする。伸ばす要求は黙って無視する。 */
export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const post = await prisma.post.findFirst({ where: { id, authorId: userId, deletedAt: null } });
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  const b = await readBody(req);
  const requested = b.expireNow ? new Date() : new Date(b.expiresAt ?? "");
  if (Number.isNaN(requested.getTime())) return NextResponse.json({ error: "expiresAt" }, { status: 400 });
  const expiresAt = shortenExpiry(post.expiresAt, requested);
  await prisma.post.update({ where: { id }, data: { expiresAt } });
  return NextResponse.json({ expiresAt: expiresAt.toISOString() });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const r = await prisma.post.updateMany({ where: { id, authorId: userId, deletedAt: null }, data: { deletedAt: new Date() } });
  if (r.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
