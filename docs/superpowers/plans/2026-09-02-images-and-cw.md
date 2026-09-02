# 画像添付と注意文（CW）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 投稿に画像（最大4枚）と書き手の注意文を付けられるようにし、伏せた状態では本文も画像も取得先もサーバから出さない。

**Architecture:** 画像はブラウザで縮小してから `POST /api/posts` の multipart で本文と一緒に受け、`lib/image.ts` が sharp で EXIF を落として WebP と blurhash を作り、`lib/storage.ts` が Vercel Blob（無ければローカルディスク）に置く。伏せ判定は `lib/veil.ts` に注意文の優先を足す。伏せた投稿のタイムラインは blurhash と寸法だけを持ち、reveal が画像 ID を返し、`GET /api/images/:id` が会員かつ可視のときだけ代理で返す。

**Tech Stack:** Next.js 16 App Router、Prisma 7 + PostgreSQL、sharp、blurhash、@vercel/blob、Vitest

**Spec:** `docs/superpowers/specs/2026-09-02-images-and-cw-design.md`

## Global Constraints

- 画像は投稿 1 件につき最大 4 枚。リクエスト全体が 4MB を超えたら 413
- 受け付ける MIME は `image/jpeg`、`image/png`、`image/webp`、`image/gif`。それ以外は 400
- 出力は WebP 品質 82、長辺 2048px 以下、EXIF なし、向きは画素に焼き込む。GIF は先頭フレームだけ
- blurhash は 64×64 に縮めた画素から 5×5
- 注意文 `cw` は最大 60 文字、空文字は null
- 伏せた投稿の応答に本文、画像 ID、画像の取得先を含めない。blurhash と寸法だけ
- 画像応答のヘッダは `Cache-Control: private, max-age=3600` と `X-Robots-Tag: noindex`
- 公開 URL を作らない。Blob は `access: "private"`、`addRandomSuffix: false`
- Blob のキーは `images/<postId>/<imageId>.webp`
- `BLOB_READ_WRITE_TOKEN` 未設定ならローカルディスク `.data/images/` に落とす
- コミットはこの計画では行わない。利用者の指示があるまで作業ツリーに置く
- 人が読む文字列はすべて日本語

---

### Task 1: Codex レビュー R1-01〜03 の採用

**Files:**
- Modify: `app/(app)/c/[circleId]/new/page.tsx:12`
- Modify: `app/api/cron/digest/route.ts:10-13,26`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: タグ候補から期限切れ投稿を除く**

`app/(app)/c/[circleId]/new/page.tsx` の `prisma.post.findMany` の `where` を次にする。

```ts
where: { circleId, deletedAt: null, expiresAt: { gt: new Date() } },
```

- [ ] **Step 2: ダイジェストから期限切れ投稿を除く**

`app/api/cron/digest/route.ts` の `posts: { where: { createdAt: { gt: since }, deletedAt: null }, ...` を次にする。

```ts
posts: { where: { createdAt: { gt: since }, deletedAt: null, expiresAt: { gt: new Date() } }, select: { authorId: true }, take: 1 },
```

- [ ] **Step 3: CRON_SECRET 未設定を拒否する**

同ファイルの認証判定を次に置き換える。

```ts
const secret = process.env.CRON_SECRET;
if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

- [ ] **Step 4: 型検査と lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: エラー 0

---

### Task 2: スキーマ拡張

**Files:**
- Modify: `prisma/schema.prisma`（Post モデルと末尾）
- Create: `prisma/migrations/<timestamp>_images_and_cw/migration.sql`（`prisma migrate dev` が生成）

**Interfaces:**
- Produces: `Post.cw: string | null`、`Post.images: Image[]`、モデル `Image { id, postId, key, blurhash, width, height, bytes, createdAt }`

- [ ] **Step 1: Post に cw と images を足す**

`model Post` の `deletedAt DateTime?` の次の行に追加する。

```prisma
  cw        String?
  images    Image[]
```

- [ ] **Step 2: Image モデルを追加する**

ファイル末尾に追加する。

```prisma
model Image {
  id        String   @id @default(cuid())
  postId    String
  key       String   @unique
  blurhash  String
  width     Int
  height    Int
  bytes     Int
  createdAt DateTime @default(now())
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId, createdAt])
}
```

- [ ] **Step 3: マイグレーションを作って適用する**

Run: `npx prisma migrate dev --name images_and_cw`
Expected: `Your database is now in sync with your schema.` と表示され、`lib/generated/prisma` が再生成される

- [ ] **Step 4: 型検査**

Run: `npx tsc --noEmit`
Expected: エラー 0

---

### Task 3: 伏せ判定に注意文を足す

**Files:**
- Modify: `lib/veil.ts`
- Test: `lib/veil.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `veilFor(tags: readonly string[], muteWords: readonly string[], cw?: string | null): Veil`。`cw` が非空なら `{ veiled: true, reason: cw }` を最優先で返す

- [ ] **Step 1: 失敗するテストを書く**

`lib/veil.test.ts` の末尾に追加する。

```ts
describe("注意文（cw）", () => {
  it("注意文があれば地雷宣言が無くても伏せ、理由は注意文そのもの", () => {
    expect(veilFor(["推し"], [], "最終回の話")).toEqual({ veiled: true, reason: "最終回の話" });
  });
  it("注意文は地雷宣言より優先する", () => {
    expect(veilFor(["ネタバレ"], ["ネタバレ"], "閲覧注意")).toEqual({ veiled: true, reason: "閲覧注意" });
  });
  it("注意文が空か null なら従来の判定に戻る", () => {
    expect(veilFor(["推し"], ["ネタバレ"], "")).toEqual({ veiled: false });
    expect(veilFor(["推し"], ["ネタバレ"], null)).toEqual({ veiled: false });
    expect(veilFor([], ["ネタバレ"], null)).toEqual({ veiled: true, reason: UNCONFIRMED });
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run lib/veil.test.ts`
Expected: 「注意文があれば」のテストが `{ veiled: false }` を受け取って FAIL

- [ ] **Step 3: 実装する**

`lib/veil.ts` の `veilFor` を次に置き換える。先頭のコメントにも「書き手の注意文（cw）があれば最優先で伏せる」の一行を足す。

```ts
export function veilFor(tags: readonly string[], muteWords: readonly string[], cw?: string | null): Veil {
  const warning = cw?.trim();
  if (warning) return { veiled: true, reason: warning };

  const mutes = muteWords.map(normalizeWord).filter((w) => w.length > 0);
  if (mutes.length === 0) return { veiled: false };

  const normalizedTags = tags.map(normalizeWord).filter((t) => t.length > 0);
  if (normalizedTags.length === 0) return { veiled: true, reason: UNCONFIRMED };

  for (const tag of normalizedTags) {
    for (const mute of mutes) {
      if (tag === mute || tag.includes(mute)) {
        const original = muteWords.find((w) => normalizeWord(w) === mute) ?? mute;
        return { veiled: true, reason: original };
      }
    }
  }
  return { veiled: false };
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `npx vitest run lib/veil.test.ts`
Expected: 全件 PASS

---

### Task 4: 画像処理 `lib/image.ts`

**Files:**
- Create: `lib/image.ts`
- Test: `lib/image.test.ts`

**Interfaces:**
- Produces:
  - `ACCEPTED_TYPES: ReadonlySet<string>`（`image/jpeg`、`image/png`、`image/webp`、`image/gif`）
  - `processImage(input: Buffer): Promise<{ webp: Buffer; blurhash: string; width: number; height: number }>`。不正な画像は throw

- [ ] **Step 1: 失敗するテストを書く**

`lib/image.test.ts` を作る。テスト画像は sharp でその場で作る。

```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage } from "./image";

/** 横 300×縦 200 の赤い JPEG に、EXIF の向き 6（右に 90 度回して表示）と GPS を付ける */
async function jpegWithOrientation6(): Promise<Buffer> {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: "#e03030" } })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Software: "fubako-test" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "35/1 40/1 0/1" } },
    })
    .toBuffer();
}

describe("processImage", () => {
  it("入力には EXIF（向きと GPS）が入っている", async () => {
    const meta = await sharp(await jpegWithOrientation6()).metadata();
    expect(meta.orientation).toBe(6);
    expect(meta.exif).toBeDefined();
    expect(meta.exif!.toString("latin1")).toContain("fubako-test");
  });

  it("EXIF を落とし、向きを画素に焼き込む（300×200 が 200×300 になる）", async () => {
    const out = await processImage(await jpegWithOrientation6());
    expect(out.width).toBe(200);
    expect(out.height).toBe(300);
    const meta = await sharp(out.webp).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(out.webp.toString("latin1")).not.toContain("fubako-test");
  });

  it("blurhash を返す", async () => {
    const out = await processImage(await jpegWithOrientation6());
    expect(out.blurhash.length).toBeGreaterThan(6);
  });

  it("長辺 2048px に収める", async () => {
    const big = await sharp({ create: { width: 4000, height: 1000, channels: 3, background: "#3060e0" } }).png().toBuffer();
    const out = await processImage(big);
    expect(out.width).toBe(2048);
    expect(out.height).toBe(512);
  });

  it("画像でなければ投げる", async () => {
    await expect(processImage(Buffer.from("not an image"))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run lib/image.test.ts`
Expected: `./image` が無いので FAIL

- [ ] **Step 3: 実装する**

`lib/image.ts` を作る。

```ts
import { encode } from "blurhash";
import sharp from "sharp";

/**
 * 画像の受け入れ処理。
 * - 向きは画素に焼き込み、EXIF は全て落とす（withMetadata を呼ばない）
 * - 長辺 2048px 以下の WebP 品質 82 に再エンコード。GIF は先頭フレームだけ
 * - 64×64 に縮めた画素から 5×5 の blurhash を作る
 */

export const ACCEPTED_TYPES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_EDGE = 2048;

export async function processImage(input: Buffer): Promise<{ webp: Buffer; blurhash: string; width: number; height: number }> {
  // animated: false が既定なので GIF は先頭フレームになる
  const base = sharp(input).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  const { data: webp, info } = await base.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const small = await base.clone().resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(small.data), small.info.width, small.info.height, 5, 5);
  return { webp, blurhash, width: info.width, height: info.height };
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `npx vitest run lib/image.test.ts`
Expected: 全件 PASS。「入力には EXIF が入っている」が落ちる場合は sharp の `withMetadata` の `exif` の書式が違うので、`node_modules/sharp/lib/index.d.ts` の `WriteableMetadata.exif` を読んで直す。GPS が書けないなら IFD0 の Software だけ残し、仕様書の「位置情報」を「EXIF」に改める。`meta.orientation` が `undefined` でなければ `rotate()` のあとに EXIF が残っているので、`sharp(input).rotate()` の結果を一度 `toBuffer()` してから再度 `sharp()` に通す

---

### Task 5: 保存先 `lib/storage.ts`

**Files:**
- Create: `lib/storage.ts`
- Modify: `.gitignore`（`/.data` を追加）
- Modify: `.env.example`（`BLOB_READ_WRITE_TOKEN=` を追加）

**Interfaces:**
- Produces:
  - `putObject(key: string, body: Buffer): Promise<void>`
  - `getObject(key: string): Promise<ReadableStream | null>`（無ければ null）
  - `deleteObject(key: string): Promise<void>`（無くても投げない）

- [ ] **Step 1: 実装する**

`lib/storage.ts` を作る。テストは書かない。Blob 側は外部サービスで、ローカル側は fs の薄い包みなので、Task 8 のスモークで通しに確かめる。

```ts
import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { del, get, put } from "@vercel/blob";

/**
 * 画像の保存先。呼び出し側は Blob かディスクかを知らない。
 * BLOB_READ_WRITE_TOKEN があれば Vercel Blob の private、無ければ .data/images/ 配下。
 * 公開 URL は作らない。
 */

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_ROOT = path.resolve(process.cwd(), ".data");

function localPath(key: string): string {
  const p = path.resolve(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("bad key");
  return p;
}

export async function putObject(key: string, body: Buffer): Promise<void> {
  if (useBlob) {
    await put(key, body, { access: "private", addRandomSuffix: false, contentType: "image/webp" });
    return;
  }
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, body);
}

export async function getObject(key: string): Promise<ReadableStream | null> {
  if (useBlob) {
    const r = await get(key, { access: "private" });
    return r && r.statusCode === 200 ? r.stream : null;
  }
  try {
    const buf = await readFile(localPath(key));
    return Readable.toWeb(Readable.from(buf)) as ReadableStream;
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (useBlob) {
    await del(key);
    return;
  }
  await rm(localPath(key), { force: true });
}
```

`r.statusCode` の判別が型エラーになる場合は `node_modules/@vercel/blob/dist/index.d.ts` の `GetBlobResult` を読み、200 のときだけ `stream` を持つ形に合わせる。

- [ ] **Step 2: gitignore と env.example**

`.gitignore` の末尾に `/.data` を足す。`.env.example` の `CRON_SECRET=` の次の行に `BLOB_READ_WRITE_TOKEN=     # Vercel Blob。未設定ならローカルの .data/images/ に保存する` を足す。

- [ ] **Step 3: 型検査**

Run: `npx tsc --noEmit`
Expected: エラー 0

---

### Task 6: API（投稿の受け付け、タイムライン、reveal、画像配信、削除）

**Files:**
- Modify: `lib/timeline.ts`
- Modify: `app/api/posts/route.ts`（POST）
- Modify: `app/api/posts/[id]/route.ts`（DELETE）
- Modify: `app/api/posts/[id]/reveal/route.ts`
- Create: `app/api/images/[id]/route.ts`

**Interfaces:**
- Consumes: Task 3 の `veilFor(tags, mutes, cw)`、Task 4 の `processImage`/`ACCEPTED_TYPES`、Task 5 の `putObject`/`getObject`/`deleteObject`
- Produces:
  - `TimelinePost` に `images: { blurhash: string; width: number; height: number }[]` が全投稿に付く。開いている投稿にはさらに `imageIds: string[]`
  - `GET /api/posts/:id/reveal` → `{ body: string; imageIds: string[] }`
  - `GET /api/images/:id` → `image/webp` のストリーム

- [ ] **Step 1: タイムラインの型と組み立てを変える**

`lib/timeline.ts` の `TimelinePost` を次にする。

```ts
export type TimelineImage = { blurhash: string; width: number; height: number };

export type TimelinePost = {
  id: string;
  authorName: string;
  mine: boolean;
  tags: string[];
  createdAt: string;
  expiresAt: string;
  reacted: boolean;
  images: TimelineImage[];
} & ({ veiled: false; body: string; imageIds: string[] } | { veiled: true; reason: string });
```

`findMany` の `include` に `images: { orderBy: { createdAt: "asc" }, select: { id: true, blurhash: true, width: true, height: true } }` を足す。`map` の中を次にする。

```ts
      const common = {
        id: p.id,
        authorName: p.author.name ?? "名無し",
        mine: p.authorId === userId,
        tags: p.tags,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
        reacted: p.reactions.length > 0,
        images: p.images.map(({ blurhash, width, height }) => ({ blurhash, width, height })),
      };
      const veil = p.authorId === userId ? { veiled: false as const } : veilFor(p.tags, mutes, p.cw);
      return veil.veiled
        ? { ...common, veiled: true, reason: veil.reason }
        : { ...common, veiled: false, body: p.body, imageIds: p.images.map((i) => i.id) };
```

- [ ] **Step 2: POST /api/posts を multipart 対応にする**

`app/api/posts/route.ts` の `POST` を次に置き換える。`readBody` は使わず `formData` を直接読む。JSON も受けたまま残す（スモークが使う）。

```ts
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
```

`key` は `@unique` なので、ID が決まるまでの仮の値を一意にしている。ファイル先頭に `import { randomUUID } from "node:crypto";`、`import { ACCEPTED_TYPES, processImage } from "@/lib/image";`、`import { putObject } from "@/lib/storage";` を足す。

- [ ] **Step 3: DELETE で Blob も消す**

`app/api/posts/[id]/route.ts` の `DELETE` を次にする。

```ts
export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const post = await prisma.post.findFirst({ where: { id, authorId: userId, deletedAt: null }, include: { images: true } });
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
  // Blob の削除失敗は投稿の削除を止めない。孤児の回収は作らない
  await Promise.all(post.images.map((i) => deleteObject(i.key).catch((e) => console.error("image delete failed", i.key, e))));
  return NextResponse.json({ ok: true });
}
```

ファイル先頭に `import { deleteObject } from "@/lib/storage";` を足す。

- [ ] **Step 4: reveal が画像 ID を返す**

`app/api/posts/[id]/reveal/route.ts` の `findUnique` に `include: { images: { orderBy: { createdAt: "asc" }, select: { id: true } } }` を足し、返却を次にする。

```ts
return NextResponse.json({ body: post.body, imageIds: post.images.map((i) => i.id) });
```

- [ ] **Step 5: 画像配信ルートを作る**

`app/api/images/[id]/route.ts` を作る。

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { isMember } from "@/lib/timeline";
import { isVisibleTo } from "@/lib/visibility";

/** 画像本体。会員で、投稿が読み手に可視のときだけ Blob を代理で返す。公開 URL は無い。 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const image = await prisma.image.findUnique({ where: { id }, include: { post: true } });
  if (!image || !(await isMember(userId, image.post.circleId)) || !isVisibleTo(image.post, userId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const stream = await getObject(image.key);
  if (!stream) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new Response(stream, {
    headers: {
      "content-type": "image/webp",
      "cache-control": "private, max-age=3600",
      "x-robots-tag": "noindex",
    },
  });
}
```

- [ ] **Step 6: 型検査と lint とビルド**

Run: `npx tsc --noEmit && npx eslint && npx next build 2>&1 | tail -5`
Expected: エラー 0、ビルド成功。sharp が Next のバンドルで警告を出す場合は `next.config.ts` に `serverExternalPackages: ["sharp"]` を足す

---

### Task 7: 画面（投稿フォーム、伏せカード、アーカイブ）

**Files:**
- Create: `components/NewPostForm.tsx`
- Create: `components/Blurhash.tsx`
- Modify: `app/(app)/c/[circleId]/new/page.tsx`
- Modify: `components/PostCard.tsx`
- Modify: `app/(app)/archive/page.tsx`

**Interfaces:**
- Consumes: Task 6 の `TimelinePost`（`images`、`imageIds`）、`/api/posts/:id/reveal` の `imageIds`
- Produces: `<Blurhash hash width height />`、`<NewPostForm circleId suggested />`

- [ ] **Step 1: blurhash 描画部品**

`components/Blurhash.tsx` を作る。

```tsx
"use client";
import { decode } from "blurhash";
import { useEffect, useRef } from "react";

/** blurhash を 32px 幅の canvas に描き、CSS で引き伸ばす。原画の取得先は持たない。 */
export function Blurhash({ hash, width, height }: { hash: string; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = 32;
  const h = Math.max(1, Math.round((height / width) * w));
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const pixels = decode(hash, w, h);
    const img = ctx.createImageData(w, h);
    img.data.set(pixels);
    ctx.putImageData(img, 0, 0);
  }, [hash, h]);
  return <canvas ref={ref} width={w} height={h} className="h-full w-full rounded object-cover" style={{ aspectRatio: `${width} / ${height}` }} />;
}
```

- [ ] **Step 2: 投稿フォームをクライアント部品にする**

`components/NewPostForm.tsx` を作る。画像は選んだ時点で canvas で縮め、送信時に `FormData` に載せる。

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_EDGE = 2048;
const MAX_IMAGES = 4;

/** 端末の写真を長辺 2048px の JPEG に縮める。EXIF の向きは createImageBitmap が適用する。 */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85));
}

export function NewPostForm({ circleId, suggested }: { circleId: string; suggested: string[] }) {
  const router = useRouter();
  const [images, setImages] = useState<{ blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files) return;
    const next = [...images];
    for (const f of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
      const blob = await shrink(f);
      next.push({ blob, url: URL.createObjectURL(blob) });
    }
    setImages(next);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.delete("images");
    images.forEach((img, i) => fd.append("images", img.blob, `${i}.jpg`));
    const r = await fetch("/api/posts", { method: "POST", body: fd });
    if (r.ok) {
      router.push(`/c/${circleId}`);
      router.refresh();
      return;
    }
    setError(r.status === 413 ? "画像が大きすぎます。枚数を減らしてください" : "投げられませんでした");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="circleId" value={circleId} />
      <textarea name="body" required maxLength={2000} rows={6} autoFocus placeholder="雑に投げる" className="w-full rounded border border-line bg-card px-3 py-2" />
      <input name="cw" maxLength={60} placeholder="注意文（任意。付けると全員に対して畳まれます）" className="w-full rounded border border-line bg-card px-3 py-2 text-sm" />
      <div>
        <input name="tags" list="tag-suggest" placeholder="タグ（空白区切り・任意。無ければ地雷宣言中の人には伏せられます）" className="w-full rounded border border-line bg-card px-3 py-2 text-sm" />
        <datalist id="tag-suggest">{suggested.map((t) => <option key={t} value={t} />)}</datalist>
        {suggested.length > 0 && <p className="mt-1 text-xs text-ink-soft">よく使われている語: {suggested.join("、")}</p>}
      </div>
      <div className="space-y-2">
        {images.length < MAX_IMAGES && (
          <input type="file" name="images" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => pick(e.target.files)} className="text-sm" />
        )}
        {images.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {images.map((img, i) => (
              <li key={img.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="aspect-square w-full rounded object-cover" />
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="外す" className="absolute right-1 top-1 rounded-full bg-paper/90 px-2 text-xs">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-3">
        <select name="days" defaultValue="7" className="rounded border border-line bg-card px-2 py-2 text-sm">
          <option value="1">1日で消える</option>
          <option value="3">3日で消える</option>
          <option value="7">7日で消える</option>
        </select>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button disabled={busy} className="ml-auto rounded bg-accent px-4 py-2 text-paper disabled:opacity-50">投げる</button>
      </div>
    </form>
  );
}
```

`app/(app)/c/[circleId]/new/page.tsx` の `return` を `<NewPostForm circleId={circleId} suggested={suggested} />` に置き換え、`import { NewPostForm } from "@/components/NewPostForm";` を足す。フォームの JSX と `datalist` はページから消す。

- [ ] **Step 3: PostCard に画像と blurhash を足す**

`components/PostCard.tsx` を次に置き換える。

```tsx
"use client";
import { useState } from "react";
import { Blurhash } from "@/components/Blurhash";
import type { TimelinePost } from "@/lib/timeline";

export function ImageGrid({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <ul className={`mt-2 grid gap-2 ${ids.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {ids.map((id) => (
        <li key={id}>
          <a href={`/api/images/${id}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/${id}`} alt="" loading="lazy" className="w-full rounded object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function PostCard({ post }: { post: TimelinePost }) {
  const [opened, setOpened] = useState<{ body: string; imageIds: string[] } | null>(post.veiled ? null : { body: post.body, imageIds: post.imageIds });
  const [reacted, setReacted] = useState(post.reacted);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    const r = await fetch(`/api/posts/${post.id}/reveal`);
    if (r.ok) setOpened((await r.json()) as { body: string; imageIds: string[] });
    setLoading(false);
  }
  async function react() {
    setReacted(!reacted);
    const r = await fetch(`/api/posts/${post.id}/react`, { method: "POST" });
    if (r.ok) setReacted(((await r.json()) as { reacted: boolean }).reacted);
  }

  return (
    <article className="rounded border border-line bg-card p-3 text-sm">
      <div className="flex gap-2 text-xs text-ink-soft">
        <span>{post.authorName}</span>
        <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString("ja-JP")}</time>
      </div>
      {opened === null ? (
        <button onClick={reveal} disabled={loading} className="relative mt-2 w-full overflow-hidden rounded bg-veil text-left text-ink-soft">
          {post.images.length > 0 && (
            <div className={`grid gap-1 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {post.images.map((img, i) => <Blurhash key={i} hash={img.blurhash} width={img.width} height={img.height} />)}
            </div>
          )}
          <span className="block px-3 py-4">伏せています（{post.veiled ? post.reason : ""}）。タップで開く</span>
        </button>
      ) : (
        <>
          <p className="mt-2 whitespace-pre-wrap">{opened.body}</p>
          <ImageGrid ids={opened.imageIds} />
        </>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
        {post.tags.map((t) => <span key={t}>#{t}</span>)}
        {!post.mine && (
          <button onClick={react} aria-pressed={reacted} className={`ml-auto rounded-full border px-3 py-1 ${reacted ? "border-accent bg-accent text-paper" : "border-line"}`}>
            {reacted ? "届いた" : "届ける"}
          </button>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: アーカイブに画像と注意文を出す**

`app/(app)/archive/page.tsx` の `findMany` の `include` に `images: { orderBy: { createdAt: "asc" }, select: { id: true } }` を足す。本文 `<p>` の前に注意文、後に画像を出す。描画部品は PostCard と同じ `ImageGrid` を使う（`import { ImageGrid } from "@/components/PostCard";`）。ImageGrid はクライアント部品だが、サーバ部品から文字列の配列を渡すだけなので境界を越えられる。

```tsx
            {p.cw && <p className="mt-2 text-xs text-ink-soft">注意文: {p.cw}</p>}
            <p className="mt-2 whitespace-pre-wrap">{p.body}</p>
            <ImageGrid ids={p.images.map((i) => i.id)} />
```

- [ ] **Step 5: 型検査、lint、ビルド**

Run: `npx tsc --noEmit && npx eslint && npx next build 2>&1 | tail -5`
Expected: エラー 0、ビルド成功

- [ ] **Step 6: 画面で確かめる**

Run: `npm run dev` を別ターミナルで起動し、`npm run seed` が出す「ひなた」のリンクで入る。「同担のへや」で「投げる」を開き、写真を 2 枚選んで注意文「テスト」を付けて投げる。
Expected: タイムラインに自分の投稿は開いた状態で出る。「りん」のリンクで入り直すと、同じ投稿がぼかし 2 枚と「伏せています（テスト）」で出て、タップで本文と画像が出る。DevTools の Network で、タップ前に `/api/images/` への要求が無いこと

---

### Task 8: スモークと仮データと文書

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `scripts/seed.mjs`
- Modify: `README.md`
- Modify: `docs/superpowers/CURRENT.md`

**Interfaces:**
- Consumes: Task 6 の全 API

- [ ] **Step 1: スモークに画像と注意文を足す**

`scripts/smoke.mjs` の `assert((await fetch(BASE + "/api/cron/digest")).status === 401, ...)` の行の前に追加する。テスト画像は `sharp` で作る。ファイル先頭に `import sharp from "sharp";` を足す。

```js
// 画像と注意文
const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#e03030" } }).png().toBuffer();
const form = new FormData();
form.set("circleId", circle.id);
form.set("body", "画像つき本文");
form.set("cw", "写真あり");
form.append("images", new Blob([png], { type: "image/png" }), "a.png");
form.append("images", new Blob([png], { type: "image/png" }), "b.png");
const p4 = await (await A("/api/posts", { method: "POST", body: form, headers: { "content-type": undefined } })).json();
assert(p4.id, "画像つき投稿を作る");
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
const v4 = tl.find((p) => p.id === p4.id);
assert(v4.veiled && v4.reason === "写真あり" && !("body" in v4) && !("imageIds" in v4), "注意文つきは地雷宣言に関係なく伏せられ、本文も画像 ID も無い");
assert(v4.images.length === 2 && v4.images.every((i) => i.blurhash && i.width === 300 && !("id" in i) && !("url" in i)), "伏せた投稿には blurhash と寸法だけがある");
assert(!JSON.stringify(v4).includes("/api/images/"), "伏せた応答に取得先が無い");
const opened = await (await B(`/api/posts/${p4.id}/reveal`)).json();
assert(opened.body === "画像つき本文" && opened.imageIds.length === 2, "reveal で本文と画像 ID が取れる");
const img = await B(`/api/images/${opened.imageIds[0]}`);
assert(img.ok && img.headers.get("content-type") === "image/webp" && img.headers.get("cache-control").includes("private"), "画像本体が WebP で取れる");
const C = await sessionFor("c@example.test", "C");
assert((await C(`/api/images/${opened.imageIds[0]}`)).status === 404, "非会員は画像を取れない");
await A(`/api/posts/${p4.id}`, { method: "PATCH", body: JSON.stringify({ expireNow: true }) });
assert((await B(`/api/images/${opened.imageIds[0]}`)).status === 404, "期限切れの画像は他人から取れない");
assert((await A(`/api/images/${opened.imageIds[0]}`)).ok, "期限切れでも本人は画像を取れる");
assert((await A(`/api/posts/${p4.id}`, { method: "DELETE" })).ok, "画像つき投稿を消す");
assert((await A(`/api/images/${opened.imageIds[0]}`)).status === 404, "削除後は本人も画像を取れない");
const tooBig = new FormData();
tooBig.set("circleId", circle.id);
tooBig.set("body", "大きすぎ");
tooBig.append("images", new Blob([Buffer.alloc(4.5 * 1024 * 1024)], { type: "image/png" }), "big.png");
assert((await A("/api/posts", { method: "POST", body: tooBig, headers: { "content-type": undefined } })).status === 413, "4MB 超は 413");
```

`sessionFor` が返す関数は `content-type: application/json` を既定で付けるので、multipart のときは `headers` で `undefined` を渡して消す。`fetch` は `undefined` の値のヘッダを無視しないことがあるため、`sessionFor` の実装を次にして、`undefined` を除く。

```js
  return (path, init = {}) => {
    const headers = Object.fromEntries(Object.entries({ cookie: `authjs.session-token=${s.sessionToken}`, "content-type": "application/json", ...(init.headers ?? {}) }).filter(([, v]) => v !== undefined));
    return fetch(BASE + path, { ...init, headers, redirect: "manual" });
  };
```

- [ ] **Step 2: スモークを通す**

Run: `npx next build && (npx next start -p 3000 &) && sleep 4 && node scripts/smoke.mjs; kill $(lsof -tiTCP:3000 -sTCP:LISTEN)`
Expected: `ALL OK`

- [ ] **Step 3: 仮データに注意文つき投稿を足す**

`scripts/seed.mjs` の `POSTS` に 1 件足し、INSERT に `cw` 列を加える。

```js
  [yuu, "注意文つき。開くまで誰にも本文が見えない", ["イベント"], 7, "会場の写真の話"],
```

INSERT は次にする。5 要素目が無ければ null。

```js
for (const [author, body, tags, d, cw = null] of POSTS) {
  const pid = id();
  postIds.push(pid);
  await db.query(`INSERT INTO "Post"(id,"circleId","authorId",body,tags,"expiresAt","createdAt",cw) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [pid, circleId, author, body, tags, days(d), days(d - 7), cw]);
}
```

Run: `npm run seed`
Expected: エラー無くリンクが 5 本出る

- [ ] **Step 4: README と CURRENT.md**

README の「中核となる3つの仕組み」の「1. 伏せ（veil）」の末尾に段落を足す。

```
書き手が注意文を付けた投稿は、地雷宣言の有無に関係なく全員に対して伏せられる。理由には注意文がそのまま出る。

画像も同じ判定に従う。伏せた状態ではサーバは blurhash と寸法だけを返し、画像本体は開いたあとに `/api/images/:id` が会員かつ可視のときだけ代理で返す。公開 URL は無い。アップロード時に EXIF は全て落とし、向きは画素に焼き込む。
```

「未決事項」から「画像を許すか」の行を消す。「ディレクトリ」の `lib/` に `image.ts  画像の再エンコードと blurhash` と `storage.ts  Blob かローカルディスク` を足し、`api/` に `images/` を足す。`.env` の一覧に `BLOB_READ_WRITE_TOKEN=  # 未設定ならローカル保存` を足す。

`docs/superpowers/CURRENT.md` の「状態」に「画像添付（最大4枚、EXIF 除去、blurhash、Vercel Blob private）と注意文（CW）を実装」を足し、「検証」にこのタスクで通したスモークの件数を書き、「レビュー裁定」節を末尾に置いて R1-01〜03 を採用と記す。

- [ ] **Step 5: 全検証**

Run: `npm test && npx tsc --noEmit && npx eslint`
Expected: テスト全件 PASS、エラー 0

---

## レビュー裁定

第 1 周（Codex、2026-09-02）の指摘 R2-01〜03 は全て採用し、本文へ反映した。却下した指摘は無い。
