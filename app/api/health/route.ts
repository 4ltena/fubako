import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * 生存確認。DB に 1 本だけ問い合わせて、関数と Neon の両方を起こしておく用途。
 * 何も返さない（数も状態も出さない）。
 */
export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
