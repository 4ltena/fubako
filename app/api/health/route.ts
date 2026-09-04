import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tokenize } from "@/lib/morph";

/**
 * 生存確認。DB に 1 本だけ問い合わせ、形態素解析器の辞書も読み込んでおく。
 * 関数・Neon・kuromoji の三つを起こしたままにする用途。何も返さない（数も状態も出さない）。
 */
export async function GET() {
  await Promise.all([prisma.$queryRaw`SELECT 1`, tokenize("起きています")]);
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
