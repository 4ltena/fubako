import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const IMAGE_GRANT_TTL_MS = 5 * 60 * 1000;

type ImageGrantPayload = {
  userId: string;
  postId: string;
  expiresAt: number;
};

function secret(): string | null {
  const value = process.env.AUTH_SECRET;
  return value && value.length > 0 ? value : null;
}

function signature(encoded: string, key: string): string {
  return createHmac("sha256", key).update(encoded).digest("base64url");
}

/** 開封した本人と投稿だけに結び付く、5分間の画像取得許可を発行する。 */
export function issueImageGrant(userId: string, postId: string, now: Date = new Date()): string | null {
  const key = secret();
  if (!key) return null;
  const encoded = Buffer.from(JSON.stringify({ userId, postId, expiresAt: now.getTime() + IMAGE_GRANT_TTL_MS } satisfies ImageGrantPayload)).toString("base64url");
  return `${encoded}.${signature(encoded, key)}`;
}

/** 壊れた形式・未知の署名・期限切れは全て null として安全側に倒す。 */
export function verifyImageGrant(grant: string | null | undefined, userId: string, postId: string, now: Date = new Date()): boolean {
  const key = secret();
  if (!grant || !key) return false;
  const [encoded, provided, extra] = grant.split(".");
  if (!encoded || !provided || extra) return false;
  const expected = signature(encoded, key);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ImageGrantPayload;
    return payload.userId === userId && payload.postId === postId && Number.isFinite(payload.expiresAt) && payload.expiresAt > now.getTime();
  } catch {
    return false;
  }
}
