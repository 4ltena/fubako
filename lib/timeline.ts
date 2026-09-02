import "server-only";
import { prisma } from "@/lib/db";
import { veilFor } from "@/lib/veil";
import { isVisibleTo } from "@/lib/visibility";

/**
 * 読み手に渡す投稿。伏せた投稿は body を持たない（サーバ側で落とす）。
 * 反応の数は持たない。自分が反応したかだけ持つ。
 */
export type TimelinePost = {
  id: string;
  authorName: string;
  mine: boolean;
  tags: string[];
  createdAt: string;
  expiresAt: string;
  reacted: boolean;
} & ({ veiled: false; body: string } | { veiled: true; reason: string });

export async function muteWordsOf(userId: string): Promise<string[]> {
  const rules = await prisma.muteRule.findMany({ where: { userId }, select: { word: true } });
  return rules.map((r) => r.word);
}

export async function isMember(userId: string, circleId: string): Promise<boolean> {
  const m = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } } });
  return m !== null;
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
      include: { author: { select: { name: true } }, reactions: { where: { userId }, select: { userId: true } } },
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
      };
      // 自分の投稿は伏せない
      const veil = p.authorId === userId ? { veiled: false as const } : veilFor(p.tags, mutes);
      return veil.veiled ? { ...common, veiled: true, reason: veil.reason } : { ...common, veiled: false, body: p.body };
    });
}
