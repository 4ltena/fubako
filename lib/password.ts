/**
 * テスト用のパスワードログイン（`PASSWORD_LOGIN=1` のときのみ）のハッシュ化。
 * Node 標準の scrypt を使う。追加の依存を持たない。
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/** `salt:hash`（どちらも hex）の形の文字列を返す。 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  const storedBuf = Buffer.from(stored, "hex");
  if (storedBuf.length !== derived.length) return false;
  return timingSafeEqual(derived, storedBuf);
}
