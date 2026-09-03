import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

/**
 * 1日1回のダイジェスト。数は書かない、急かさない（原則 C）。
 * Vercel Cron（または scripts/cron.mjs）が Authorization: Bearer CRON_SECRET で叩く。
 *
 * 反応の知らせは投稿ごとに印（reactionNotifiedAt）を残し、同じ反応で二度言わない。
 * 印より新しい反応が付いたときだけ、もう一度だけ知らせる。
 */

/** その人に届ける材料。件数は数えず、あるか無いかだけを引く。 */
async function digestFor(userId: string, since: Date, now: Date) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      memberships: {
        select: {
          circle: {
            select: {
              name: true,
              // 自分以外の新しい紙が1枚でもあるか
              posts: {
                where: { createdAt: { gt: since }, deletedAt: null, expiresAt: { gt: now }, NOT: { authorId: userId } },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      },
      // 反応が付いた自分の紙。印より新しい反応だけを見る
      posts: {
        where: { deletedAt: null, reactions: { some: {} } },
        select: { id: true, reactionNotifiedAt: true, reactions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
      },
    },
  });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ids = await prisma.user.findMany({ where: { email: { not: null } }, select: { id: true } });

  const transport = nodemailer.createTransport(process.env.EMAIL_SERVER);
  let sent = 0;
  for (const { id } of ids) {
    const u = await digestFor(id, since, now);
    if (!u?.email) continue;
    const circles = u.memberships.map((m) => m.circle).filter((c) => c.posts.length > 0);
    const unseen = u.posts.filter((p) => {
      const latest = p.reactions[0]?.createdAt;
      if (!latest) return false;
      return p.reactionNotifiedAt === null ? latest > since : latest > p.reactionNotifiedAt;
    });
    const lines: string[] = [];
    if (circles.length > 0) lines.push(`新しい投稿があります: ${circles.map((c) => c.name).join("、")}`);
    if (unseen.length > 0) lines.push("あなたの投稿に反応がありました");
    if (lines.length === 0) continue;
    try {
      await transport.sendMail({
        to: u.email,
        from: process.env.EMAIL_FROM,
        subject: "ふばこ 今日のダイジェスト",
        text: [...lines, "", process.env.APP_URL ?? "", "", "――", "ふばこ"].join("\n"),
      });
      // 送れてから印を付ける。送れなかった人はそのまま次の便に持ち越す
      if (unseen.length > 0) {
        await prisma.post.updateMany({ where: { id: { in: unseen.map((p) => p.id) } }, data: { reactionNotifiedAt: now } });
      }
      sent++;
    } catch (e) {
      // 1人送れなくても、残りの人の便りは止めない
      console.error(JSON.stringify({ event: "digest_failed", userId: id, error: String(e) }));
    }
  }
  return NextResponse.json({ sent });
}
