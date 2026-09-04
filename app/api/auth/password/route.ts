import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

const SESSION_DAYS = 30;

/**
 * テスト用のパスワードログイン。`PASSWORD_LOGIN=1` のときだけ有効。
 * 未登録の名前はその場でアカウントを作る。Auth.js の Credentials は使わず、
 * 開発用ログイン（/api/dev/login）と同じ形で Session 行を作って Cookie を載せる。
 *
 * 作らないもの: パスワードの再設定・メール確認・アカウント削除・レート制限。
 * 発表後に PASSWORD_LOGIN を外して閉じる前提のテスト用の入口。
 */
export async function POST(req: Request) {
  if (process.env.PASSWORD_LOGIN !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const fd = await req.formData();
  const handle = String(fd.get("handle") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const fail = () => NextResponse.redirect(new URL("/login?password=wrong", req.url), 303);
  if (handle.length < 1 || handle.length > 20 || password.length < 8) return fail();

  const user = await prisma.user.findUnique({ where: { handle } });
  if (user) {
    if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) return fail();
    return signIn(req, user.id);
  }
  const created = await prisma.user.create({
    data: { handle, name: handle, passwordHash: await hashPassword(password) },
  });
  return signIn(req, created.id);
}

async function signIn(req: Request, userId: string) {
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const session = await prisma.session.create({ data: { sessionToken: randomUUID(), userId, expires } });
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set("authjs.session-token", session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expires,
  });
  return res;
}
