import { NextResponse } from "next/server";
import { done, readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isMember, timelineFor } from "@/lib/timeline";
import { defaultExpiresAt, DEFAULT_LIFETIME_MS } from "@/lib/visibility";

/** タイムライン。伏せた投稿は body を含まない。 */
export async function GET(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const circleId = new URL(req.url).searchParams.get("circleId") ?? "";
  const posts = await timelineFor(userId, circleId);
  if (posts === null) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ posts });
}

export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(/[\s,、]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 10);
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const b = await readBody(req);
  const body = (b.body ?? "").trim();
  if (!body || body.length > 2000) return NextResponse.json({ error: "body" }, { status: 400 });
  const circleId = b.circleId ?? "";
  if (!(await isMember(userId, circleId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const now = new Date();
  // 寿命は既定 7 日。それより短い指定だけ受ける（原則 B）。
  const days = Number(b.days);
  const requested = Number.isFinite(days) && days > 0 ? new Date(now.getTime() + days * 86400_000) : defaultExpiresAt(now);
  const expiresAt = new Date(Math.min(requested.getTime(), now.getTime() + DEFAULT_LIFETIME_MS));
  const post = await prisma.post.create({
    data: { circleId, authorId: userId, body, tags: parseTags(b.tags ?? ""), expiresAt },
  });
  return done(req, `/c/${circleId}`, { id: post.id });
}
