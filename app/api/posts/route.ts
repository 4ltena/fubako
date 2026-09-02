import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { done, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ACCEPTED_TYPES, processImage } from "@/lib/image";
import { deleteObject, putObject } from "@/lib/storage";
import { isMember, timelineFor } from "@/lib/timeline";
import { defaultExpiresAt, DEFAULT_LIFETIME_MS } from "@/lib/visibility";

const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

/**
 * Content-Length は自己申告なので信用しない。実バイト数を数えながら読む。
 * 上限を超えたら以降は溜め込まずに捨てる（メモリは上限で頭打ち）が、読み込み自体は最後まで続ける。
 * 読みかけで打ち切ると keep-alive の接続に生のバイトが残り、次のリクエストと混線して切断される。
 */
async function readBounded(req: Request, max: number): Promise<ArrayBuffer | null> {
  const reader = req.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  let overflowed = false;
  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    total += value.byteLength;
    if (total > max) {
      overflowed = true;
      continue;
    }
    chunks.push(value);
  }
  if (overflowed) return null;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
}

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

  const raw = await readBounded(req, MAX_REQUEST_BYTES);
  if (raw === null) return NextResponse.json({ error: "too large" }, { status: 413 });
  const bodyReq = new Request(req.url, { method: "POST", headers: req.headers, body: raw });

  const isForm = !(req.headers.get("content-type") ?? "").includes("json");
  const fd = isForm ? await bodyReq.formData() : null;
  const b = fd ? Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v)])) : ((await bodyReq.json()) as Record<string, string>);
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
  const uploadedKeys: string[] = [];
  try {
    for (const img of processed) {
      const image = await prisma.image.create({
        data: { postId: post.id, key: `pending/${randomUUID()}`, blurhash: img.blurhash, width: img.width, height: img.height, bytes: img.webp.byteLength },
      });
      const key = `images/${post.id}/${image.id}.webp`;
      await putObject(key, img.webp);
      uploadedKeys.push(key);
      await prisma.image.update({ where: { id: image.id }, data: { key } });
    }
  } catch (err) {
    // 保存先の失敗で投稿だけ残ると、クライアントは失敗と誤解して再送し二重投稿になる。
    // 投稿ごと消して最初からやり直せるようにする（Image は Post に cascade）。
    await Promise.all(
      uploadedKeys.map((key) =>
        deleteObject(key).catch((e) => console.error(JSON.stringify({ event: "image_upload_cleanup_failed", postId: post.id, key, error: String(e) }))),
      ),
    );
    await prisma.post.delete({ where: { id: post.id } });
    console.error(JSON.stringify({ event: "image_upload_failed", postId: post.id, error: String(err) }));
    return NextResponse.json({ error: "image upload failed" }, { status: 502 });
  }
  return done(req, `/c/${circleId}`, { id: post.id });
}
