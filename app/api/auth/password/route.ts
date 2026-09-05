import { randomUUID } from "node:crypto";
import { sessionCookieName } from "@/lib/api";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeHandle } from "@/lib/handle";

const SESSION_DAYS = 30;

/**
 * テスト用のログイン。`PASSWORD_LOGIN=1` のときだけ有効で、名前だけで入る。
 * 未登録の名前はその場でアカウントを作る。パスワード欄は画面に網掛けで残すだけ。Auth.js の Credentials は使わず、
 * 開発用ログイン（/api/dev/login）と同じ形で Session 行を作って Cookie を載せる。
 *
 * 外部サイトからの自動 POST（ログイン CSRF）は、Origin か Sec-Fetch-Site で同一オリジンを確かめて弾く。
 * 名前は normalizeHandle で寄せ、見た目が同じ別名でのなりすましを防ぐ。
 *
 * 作らないもの: パスワードの再設定・メール確認・アカウント削除・レート制限。
 * 発表後に PASSWORD_LOGIN を外して閉じる前提のテスト用の入口。
 */
export async function POST(req: Request) {
  if (process.env.PASSWORD_LOGIN !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const fd = await req.formData();
  const { key: handle, display } = normalizeHandle(String(fd.get("handle") ?? ""));
  const fail = () => NextResponse.redirect(new URL("/login?password=wrong", req.url), 303);
  if (handle.length < 1 || handle.length > 20) return fail();

  // テスト中は名前だけで入る。パスワードは受け取らず、照合もしない（発表後に入口ごと閉じる）。
  const user = await prisma.user.findUnique({ where: { handle } });
  if (user) return signIn(req, user.id);
  const created = await prisma.user.create({ data: { handle, name: display } });
  return signIn(req, created.id);
}

/** ブラウザからの POST は Origin か Sec-Fetch-Site を必ず付ける。付いていて自分と違えば他サイトからの送信。 */
function sameOrigin(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  return origin === null || origin === new URL(req.url).origin;
}

async function signIn(req: Request, userId: string) {
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const session = await prisma.session.create({ data: { sessionToken: randomUUID(), userId, expires } });
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(sessionCookieName(req), session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expires,
  });
  return res;
}
