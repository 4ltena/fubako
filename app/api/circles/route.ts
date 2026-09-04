import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { done, readBody, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { memberLimit } from "@/lib/memberLimit";
import { makeInvite } from "@/lib/invite";

/** 誰も使っていない招待の言葉を作る。 */
async function freshInvite(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const word = makeInvite((max) => randomInt(0, max));
    if (!(await prisma.circle.findUnique({ where: { inviteCode: word }, select: { id: true } }))) return word;
  }
  throw new Error("invite collision");
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const { name } = await readBody(req);
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed.length > 40) return NextResponse.json({ error: "name" }, { status: 400 });
  const circle = await prisma.circle.create({
    data: {
      name: trimmed,
      // 口で言える言葉にする。ぶつかったら作り直す（44^10 なのでまず起きない）
      inviteCode: await freshInvite(),
      createdById: userId,
      // 定員は既定 30。発表など大人数で使うときだけ環境変数で広げる（設定画面は作らない）
      memberLimit: memberLimit(),
      memberships: { create: { userId } },
    },
  });
  return done(req, `/c/${circle.id}`, { id: circle.id, inviteCode: circle.inviteCode });
}
