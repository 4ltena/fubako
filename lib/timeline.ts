import "server-only";
import { prisma } from "@/lib/db";
import type { Form } from "@/lib/form";
import { presentToday, shouldTouchSeen } from "@/lib/presence";
import { veilFor } from "@/lib/veil";
import { isVisibleTo } from "@/lib/visibility";

/**
 * 読み手に渡す投稿。伏せた投稿は body と画像 ID を持たない（サーバ側で落とす）。
 * 反応の数は持たない。自分が反応したかだけ持つ。
 *
 * form は伏せた投稿には載せない。形から本文の内容が推測できるため。
 */
export type TimelineImage = { blurhash: string; width: number; height: number };

export type TimelinePost = {
  id: string;
  authorName: string;
  mine: boolean;
  tags: string[];
  createdAt: string;
  expiresAt: string;
  reacted: boolean;
  images: TimelineImage[];
} & ({ veiled: false; body: string; imageIds: string[]; form: Form } | { veiled: true; reason: string });

export async function muteWordsOf(userId: string): Promise<string[]> {
  const rules = await prisma.muteRule.findMany({ where: { userId }, select: { word: true } });
  return rules.map((r) => r.word);
}

export async function isMember(userId: string, circleId: string): Promise<boolean> {
  const m = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } } });
  return m !== null;
}

/**
 * 「今日、この場に来た人がいるか」。読み手の lastSeenAt もここで更新する（1時間に1回まで）。
 *
 * 返すのは真偽値だけ。誰が・何人・いつ来たかは呼び出し側にも渡さない。
 * lastSeenAt は本人にも他人にも見せず、API にも載せない。
 */
export async function seenAndPresentToday(userId: string, circleId: string, now: Date = new Date()): Promise<boolean> {
  const members = await prisma.membership.findMany({ where: { circleId }, select: { userId: true, lastSeenAt: true } });
  const mine = members.find((m) => m.userId === userId);
  if (mine === undefined) return false;
  if (shouldTouchSeen(mine.lastSeenAt, now)) {
    await prisma.membership.update({ where: { userId_circleId: { userId, circleId } }, data: { lastSeenAt: now } });
  }
  return presentToday(members, userId, now);
}

/** サークルのタイムライン。会員でなければ null（存在自体を見せない）。 */
export async function timelineFor(userId: string, circleId: string): Promise<TimelinePost[] | null> {
  if (!(await isMember(userId, circleId))) return null;
  const now = new Date();
  const [posts, mutes] = await Promise.all([
    prisma.post.findMany({
      where: { circleId, deletedAt: null, OR: [{ expiresAt: { gt: now } }, { authorId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: { select: { name: true } },
        reactions: { where: { userId }, select: { userId: true } },
        images: { orderBy: { createdAt: "asc" }, select: { id: true, blurhash: true, width: true, height: true } },
      },
    }),
    muteWordsOf(userId),
  ]);
  return posts
    .filter((p) => isVisibleTo(p, userId, now))
    .map((p) => {
      const common = {
        id: p.id,
        authorName: p.author.name ?? "名無し",
        mine: p.authorId === userId,
        tags: p.tags,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
        reacted: p.reactions.length > 0,
        images: p.images.map(({ blurhash, width, height }) => ({ blurhash, width, height })),
      };
      // 自分の投稿は伏せない
      const veil = p.authorId === userId ? { veiled: false as const } : veilFor(p.tags, mutes, p.cw);
      return veil.veiled
        ? { ...common, veiled: true, reason: veil.reason }
        : { ...common, veiled: false, body: p.body, imageIds: p.images.map((i) => i.id), form: p.form as Form };
    });
}
