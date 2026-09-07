import { NextResponse } from "next/server";
import { validateAfterword } from "@/lib/afterword";
import { readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** 後書きは元の紙とは別に、書いた本人だけが読み書きする。 */
export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const post = await prisma.post.findFirst({
    where: { id, authorId: userId, deletedAt: null },
    select: { afterword: true },
  });
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ afterword: post.afterword });
}

export async function PUT(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const value = validateAfterword((await readBody(req)).afterword);
  if ("error" in value) return NextResponse.json({ error: value.error }, { status: 400 });
  const { id } = await params;
  // deletedAt も条件に入れて、削除と同時に後書きだけが復活することを防ぐ。
  const result = await prisma.post.updateMany({
    where: { id, authorId: userId, deletedAt: null },
    data: { afterword: value.afterword },
  });
  if (result.count !== 1) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ afterword: value.afterword });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const result = await prisma.post.updateMany({
    where: { id, authorId: userId, deletedAt: null },
    data: { afterword: "" },
  });
  if (result.count !== 1) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ afterword: "" });
}
