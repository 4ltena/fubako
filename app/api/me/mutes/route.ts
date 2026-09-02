import { NextResponse } from "next/server";
import { done, readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { normalizeWord } from "@/lib/veil";

export async function GET() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const rules = await prisma.muteRule.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ rules: rules.map((r) => ({ id: r.id, word: r.word })) });
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const word = (await readBody(req)).word?.trim() ?? "";
  if (!word || word.length > 40 || !normalizeWord(word)) return NextResponse.json({ error: "word" }, { status: 400 });
  const rule = await prisma.muteRule.upsert({
    where: { userId_word: { userId, word } },
    update: {},
    create: { userId, word },
  });
  return done(req, "/settings/mutes", { id: rule.id, word: rule.word });
}

export async function DELETE(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  await prisma.muteRule.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
