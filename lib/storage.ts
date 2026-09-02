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
