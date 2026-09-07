import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isTemporaryLoginAllowed } from "@/lib/auth-policy";

/**
 * 開発専用。seed が作ったセッションのトークンを Cookie に載せて "/" へ送る。
 * 本番ビルドでは存在しないのと同じ 404 を返す。
 */
export async function GET(req: Request) {
  if (!isTemporaryLoginAllowed("dev")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const session = await prisma.session.findUnique({ where: { sessionToken: token } });
  // 古いリンク（seed を流し直した・スモークが消した）は、生の JSON ではなく入口へ戻す
  if (!session || session.authMethod !== "demo" || session.expires < new Date()) return NextResponse.redirect(new URL("/login?dev=stale", req.url), 303);
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(sessionCookieName(req), token, { httpOnly: true, sameSite: "lax", path: "/", expires: session.expires });
  return res;
}
