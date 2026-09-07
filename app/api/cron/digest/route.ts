import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { veilFor } from "@/lib/veil";

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
        where: { archivedAt: null },
        select: {
          circle: {
            select: {
              id: true,
              name: true,
              // 自分以外の新しい紙が1枚でもあるか
              posts: {
                where: { createdAt: { gt: since }, visibility: "circle", deletedAt: null, expiresAt: { gt: now }, NOT: { authorId: userId } },
                select: {
                  id: true,
                  body: true,
                  cw: true,
                  tags: true,
                  veils: { where: { userId }, select: { userId: true } },
                },
                take: 100,
              },
            },
          },
        },
      },
      muteRules: { select: { word: true } },
      topicMutes: { select: { circleId: true, word: true } },
      // 反応が付いた自分の紙。印より新しい反応だけを見る
      posts: {
        // 本人が保管した箱では、反応も便りの材料にしない。アーカイブ画面の受領表示とは分ける。
        where: {
          deletedAt: null,
          visibility: "circle",
          circle: { memberships: { some: { userId, archivedAt: null } } },
          reactions: { some: { userId: { not: userId } } },
        },
        select: {
          id: true,
          reactionNotifiedAt: true,
          reactions: {
            where: { userId: { not: userId } },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          },
        },
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
  const ids = await prisma.user.findMany({ where: { email: { not: null }, digestEnabled: true }, select: { id: true } });

  const transport = nodemailer.createTransport(process.env.EMAIL_SERVER);
  let sent = 0;
  for (const { id } of ids) {
    const u = await digestFor(id, since, now);
    if (!u?.email) continue;
    const muteWords = u.muteRules.map((rule) => rule.word);
    // 伏せられる投稿があることも便りでは知らせない。本文・注意文・タグは判定後に捨てる。
    const circles = u.memberships
      .map((m) => m.circle)
      .filter((circle) =>
        circle.posts.some(
          (post) => !veilFor(
            { body: post.body, cw: post.cw, tags: post.tags },
            [...muteWords, ...(u.topicMutes ?? []).filter((rule) => rule.circleId === circle.id).map((rule) => rule.word)],
            { selfVeiled: post.veils.length > 0 },
          ).veiled,
        ),
      );
    const unseen = u.posts.filter((p) => {
      // 退出・取消の前に残した明示的反応も、投稿者には受領として残る。
      const latest = p.reactions[0]?.createdAt;
      if (!latest) return false;
      return p.reactionNotifiedAt === null ? latest > since : latest > p.reactionNotifiedAt;
    });
    const lines: string[] = [];
    if (circles.length > 0) lines.push(`新しい投稿があります: ${circles.map((c) => c.name).join("、")}`);
    if (unseen.length > 0) lines.push("あなたの投稿に反応がありました");
    if (lines.length === 0) continue;
    try {
      // 収集後にも止められる。SMTP の開始直前にもう一度設定を読む。
      const preference = await prisma.user.findUnique({ where: { id }, select: { email: true, digestEnabled: true } });
      if (!preference?.digestEnabled || preference.email !== u.email) continue;
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
