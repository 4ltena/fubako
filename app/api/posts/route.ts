import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { done, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { inferForm } from "@/lib/form";
import { ACCEPTED_TYPES, processImage } from "@/lib/image";
import { extractTerms, RECENT_BODIES } from "@/lib/similar";
import { deleteObject, putObject } from "@/lib/storage";
import { isMember, timelineFor } from "@/lib/timeline";
import { DEFAULT_LIFETIME_MS } from "@/lib/visibility";
import { normalizeWord } from "@/lib/veil";

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

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(/[\s,、]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean))].slice(0, 10);
}

/**
 * その投稿の語。同じ書き手の直近の本文も一緒に見て、繰り返し出る固有名詞を先頭に置く。
 * サークルのタグの語は、本文との文字列一致で固有名詞として拾う（terms）。
 * 語はここから外に出さない（API にも画面にも載せない）。
 */
async function termsFor(userId: string, circleId: string, body: string, tags: string[]): Promise<string[]> {
  const [recent, tagRows] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: userId, circleId, visibility: "circle", deletedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: RECENT_BODIES,
      select: { body: true },
    }),
    prisma.post.findMany({ where: { circleId, visibility: "circle", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 200, select: { tags: true } }),
  ]);
  const circleTags = [...new Set([...tags, ...tagRows.flatMap((r) => r.tags)])];
  return extractTerms(body, recent.map((r) => r.body), { terms: circleTags });
}

/** 投稿。multipart なら画像を受け付ける。JSON はスモークが使うのでそのまま残す。 */
export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;

  const raw = await readBounded(req, MAX_REQUEST_BYTES);
  if (raw === null) return NextResponse.json({ error: "too large" }, { status: 413 });
  const bodyReq = new Request(req.url, { method: "POST", headers: req.headers, body: raw });

  const isForm = !(req.headers.get("content-type") ?? "").includes("json");
  let fd: FormData | null;
  let b: Record<string, string>;
  try {
    fd = isForm ? await bodyReq.formData() : null;
    const parsed = fd ? Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) : await bodyReq.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body");
    for (const field of ["body", "cw", "tags", "circleId", "clientRequestId", "visibility"]) {
      if (parsed[field] !== undefined && typeof parsed[field] !== "string") throw new Error(field);
    }
    b = parsed as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "body" }, { status: 400 });
  }
  const files = fd ? fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0) : [];

  const body = (b.body ?? "").trim();
  if (files.length > 4) return NextResponse.json({ error: "too many images" }, { status: 400 });
  // 写真だけの紙（一枚）を通す。本文が空でよいのは画像があるときだけ。
  if ((!body && files.length === 0) || body.length > 2000) return NextResponse.json({ error: "body" }, { status: 400 });
  const cw = (b.cw ?? "").trim().slice(0, 60) || null;
  if (files.some((f) => !ACCEPTED_TYPES.has(f.type))) return NextResponse.json({ error: "image type" }, { status: 400 });
  const circleId = b.circleId ?? "";
  const visibility = b.visibility ?? "circle";
  if (visibility !== "circle" && visibility !== "private") return NextResponse.json({ error: "visibility" }, { status: 400 });
  if (!(await isMember(userId, circleId))) return NextResponse.json({ error: "not found" }, { status: 404 });

  const clientRequestId = b.clientRequestId ?? "";
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(clientRequestId)) {
    return NextResponse.json({ error: "clientRequestId" }, { status: 400 });
  }

  const now = new Date();
  // 寿命は既定 7 日。それより短い指定だけ受ける（原則 B）。
  const days = Number(b.days);
  const lifetime = Number.isFinite(days) && days > 0 ? Math.min(days * 86400_000, DEFAULT_LIFETIME_MS) : DEFAULT_LIFETIME_MS;
  const expiresAt = new Date(now.getTime() + lifetime);

  let processed: Awaited<ReturnType<typeof processImage>>[];
  let imageBytes: Buffer[];
  try {
    imageBytes = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    processed = await Promise.all(imageBytes.map((bytes) => processImage(bytes)));
  } catch {
    return NextResponse.json({ error: "image" }, { status: 400 });
  }

  const tags = parseTags(b.tags ?? "");
  // 語の抽出は作成時に1回。辞書が使えない場合も投稿は続けられる。
  const terms = await termsFor(userId, circleId, body, tags);
  const requestHash = createHash("sha256").update(JSON.stringify({
    circleId, body, cw, visibility, tags: [...new Set(tags.map(normalizeWord))].sort(), lifetime,
    images: imageBytes.map((bytes) => createHash("sha256").update(bytes).digest("hex")),
  })).digest("hex");
  const uploadedKeys: string[] = [];
  let attemptedPostId: string | null = null;
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 参加取消・退出と同じ箱行を先にロックし、取消後の投稿を通さない。
      await tx.$queryRaw`SELECT id FROM "Circle" WHERE id = ${circleId} FOR UPDATE`;
      const membership = await tx.membership.findUnique({ where: { userId_circleId: { userId, circleId } } });
      if (!membership) return { status: 404 as const };
      // 保存前に同じ送信を直列化する。ハッシュの衝突は余分に待つだけで混同しない。
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${clientRequestId}))`;
      const existing = await tx.post.findUnique({ where: { authorId_clientRequestId: { authorId: userId, clientRequestId } }, select: { id: true, requestHash: true, deletedAt: true, visibility: true } });
      if (existing) return existing.requestHash === requestHash && !existing.deletedAt ? { status: 200 as const, id: existing.id, visibility: existing.visibility } : { status: 409 as const };
      const id = randomUUID();
      attemptedPostId = id;
      const images = [];
      for (const img of processed) {
        const imageId = randomUUID();
        const key = `images/${id}/${imageId}.webp`;
        // 書き込み後にエラーとなる保存先でも、その試行のキーを回収できるよう先に記録する。
        uploadedKeys.push(key);
        await putObject(key, img.webp);
        images.push({ id: imageId, key, blurhash: img.blurhash, width: img.width, height: img.height, bytes: img.webp.byteLength });
      }
      const post = await tx.post.create({
        data: { id, circleId, authorId: userId, body, cw, tags, visibility, expiresAt, form: inferForm(body, files.length), terms, clientRequestId, requestHash, images: { create: images } },
        select: { id: true, visibility: true },
      });
      return { status: 200 as const, id: post.id, visibility: post.visibility };
    }, { maxWait: 15000, timeout: 60000 });
    if (result.status !== 200) return NextResponse.json({ error: result.status === 409 ? "request conflict" : "not found" }, { status: result.status });
    if (result.visibility === "private") return done(req, "/archive", { id: result.id, redirectTo: "/archive" });
    return done(req, `/c/${circleId}`, { id: result.id });
  } catch (err) {
    // COMMIT直後の通信断もあり得る。保存の有無を確認できない間は画像を消さない。
    let canClean = attemptedPostId === null;
    if (attemptedPostId) {
      try {
        const saved = await prisma.post.findUnique({ where: { id: attemptedPostId }, select: { id: true, deletedAt: true, visibility: true } });
        if (saved && !saved.deletedAt) {
          if (saved.visibility === "private") return done(req, "/archive", { id: saved.id, redirectTo: "/archive" });
          return done(req, `/c/${circleId}`, { id: saved.id });
        }
        canClean = !saved;
      } catch {
        console.error(JSON.stringify({ event: "post_save_outcome_unknown", postId: attemptedPostId, keys: uploadedKeys }));
      }
    }
    // ロールバックを確認できた場合だけ、この試行のキーを回収する。
    await Promise.all(
      (canClean ? uploadedKeys : []).map((key) =>
        deleteObject(key).catch((e) => console.error(JSON.stringify({ event: "image_upload_cleanup_failed", key, error: String(e) }))),
      ),
    );
    console.error(JSON.stringify({ event: "post_save_failed", error: String(err) }));
    return NextResponse.json({ error: "image upload failed" }, { status: 502 });
  }
}
