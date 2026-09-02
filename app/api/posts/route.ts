import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { done, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ACCEPTED_TYPES, processImage } from "@/lib/image";
import { putObject } from "@/lib/storage";
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

/** 投稿。multipart なら画像を受け付ける。JSON はスモークが使うのでそのまま残す。 */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 4 * 1024 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });

  const isForm = !(req.headers.get("content-type") ?? "").includes("json");
  const fd = isForm ? await req.formData() : null;
  const b = fd ? Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v)])) : ((await req.json()) as Record<string, string>);
  const files = fd ? fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0) : [];

  const body = (b.body ?? "").trim();
  if (!body || body.length > 2000) return NextResponse.json({ error: "body" }, { status: 400 });
  const cw = (b.cw ?? "").trim().slice(0, 60) || null;
  if (files.length > 4) return NextResponse.json({ error: "too many images" }, { status: 400 });
  if (files.some((f) => !ACCEPTED_TYPES.has(f.type))) return NextResponse.json({ error: "image type" }, { status: 400 });
  const circleId = b.circleId ?? "";
  if (!(await isMember(userId, circleId))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const now = new Date();
  // 寿命は既定 7 日。それより短い指定だけ受ける（原則 B）。
  const days = Number(b.days);
  const requested = Number.isFinite(days) && days > 0 ? new Date(now.getTime() + days * 86400_000) : defaultExpiresAt(now);
  const expiresAt = new Date(Math.min(requested.getTime(), now.getTime() + DEFAULT_LIFETIME_MS));

  let processed: Awaited<ReturnType<typeof processImage>>[];
  try {
    processed = await Promise.all(files.map(async (f) => processImage(Buffer.from(await f.arrayBuffer()))));
  } catch {
    return NextResponse.json({ error: "image" }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: { circleId, authorId: userId, body, cw, tags: parseTags(b.tags ?? ""), expiresAt },
  });
  for (const img of processed) {
    const image = await prisma.image.create({
      data: { postId: post.id, key: `pending/${randomUUID()}`, blurhash: img.blurhash, width: img.width, height: img.height, bytes: img.webp.byteLength },
    });
    const key = `images/${post.id}/${image.id}.webp`;
    await putObject(key, img.webp);
    await prisma.image.update({ where: { id: image.id }, data: { key } });
  }
  return done(req, `/c/${circleId}`, { id: post.id });
}
