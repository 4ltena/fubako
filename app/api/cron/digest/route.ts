import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

/**
 * 1日1回のダイジェスト。数は書かない、急かさない（原則 C）。
 * Vercel Cron が Authorization: Bearer CRON_SECRET で叩く。
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { email: { not: null } },
    select: {
      id: true,
      email: true,
      memberships: {
        select: {
          circle: {
            select: { id: true, name: true, posts: { where: { createdAt: { gt: since }, deletedAt: null }, select: { authorId: true }, take: 1 } },
          },
        },
      },
      posts: { where: { reactions: { some: { createdAt: { gt: since } } } }, select: { id: true }, take: 1 },
    },
  });

  const transport = nodemailer.createTransport(process.env.EMAIL_SERVER);
  let sent = 0;
  for (const u of users) {
    const circles = u.memberships.map((m) => m.circle).filter((c) => c.posts.some((p) => p.authorId !== u.id));
    const lines: string[] = [];
    if (circles.length > 0) lines.push(`新しい投稿があります: ${circles.map((c) => c.name).join("、")}`);
    if (u.posts.length > 0) lines.push("あなたの投稿に反応がありました");
    if (lines.length === 0) continue;
    await transport.sendMail({
      to: u.email!,
      from: process.env.EMAIL_FROM,
      subject: "ふばこ 今日のダイジェスト",
      text: [...lines, "", process.env.APP_URL ?? "", "", "――", "ふばこ"].join("\n"),
    });
    sent++;
  }
  return NextResponse.json({ sent });
}
