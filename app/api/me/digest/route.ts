import { NextResponse } from "next/server";
import { readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  let body: Record<string, string>;
  try { body = await readBody(req); }
  catch { return NextResponse.json({ error: "enabled" }, { status: 400 }); }
  if (!body || (body.enabled !== "true" && body.enabled !== "false")) {
    return NextResponse.json({ error: "enabled" }, { status: 400 });
  }
  await prisma.user.update({ where: { id: userId }, data: { digestEnabled: body.enabled === "true" } });
  return NextResponse.json({ enabled: body.enabled === "true" });
}
