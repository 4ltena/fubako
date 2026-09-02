import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { done, readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { name } = await readBody(req);
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed.length > 40) return NextResponse.json({ error: "name" }, { status: 400 });
  const circle = await prisma.circle.create({
    data: {
      name: trimmed,
      inviteCode: randomBytes(12).toString("base64url"),
      createdById: userId,
      memberships: { create: { userId } },
    },
  });
  return done(req, `/c/${circle.id}`, { id: circle.id, inviteCode: circle.inviteCode });
}
