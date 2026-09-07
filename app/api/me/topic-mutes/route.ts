import { NextResponse } from "next/server";
import { done, readBody, requireUser } from "@/lib/api";
import { lockCircle } from "@/lib/circles";
import { prisma } from "@/lib/db";
import { normalizeWord } from "@/lib/veil";

/** 箱ごとの一時的な話題の伏せ。語や設定を他人へ返さない。 */
export async function GET(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const circleId = new URL(req.url).searchParams.get("circleId") ?? undefined;
  const rules = await prisma.topicMute.findMany({
    where: { userId, ...(circleId ? { circleId } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, circleId: true, word: true },
  });
  return NextResponse.json({ rules }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  let body: Record<string, string>;
  try {
    body = await readBody(req);
  } catch {
    return NextResponse.json({ error: "body" }, { status: 400 });
  }
  const circleId = typeof body.circleId === "string" ? body.circleId.trim() : "";
  const word = typeof body.word === "string" ? body.word.trim() : "";
  const normalizedWord = normalizeWord(word);
  if (!circleId || !word || word.length > 40 || !normalizedWord) return NextResponse.json({ error: "word" }, { status: 400 });
  const rule = await prisma.$transaction(async (tx) => {
    if (!(await lockCircle(tx, circleId))) return null;
    const member = await tx.membership.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } });
    if (!member) return null;
    return tx.topicMute.upsert({
      where: { userId_circleId_normalizedWord: { userId, circleId, normalizedWord } },
      update: {},
      create: { userId, circleId, word, normalizedWord },
      select: { id: true, circleId: true, word: true },
    });
  });
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });
  return done(req, "/settings/mutes", { rule });
}

export async function DELETE(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const circleId = url.searchParams.get("circleId") ?? "";
  if (!id || !circleId) return NextResponse.json({ error: "rule" }, { status: 400 });
  await prisma.topicMute.deleteMany({ where: { id, circleId, userId } });
  return NextResponse.json({ ok: true });
}
