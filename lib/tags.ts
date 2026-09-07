import "server-only";
import { prisma } from "@/lib/db";
import { veilFor } from "@/lib/veil";
import { isVisibleTo } from "@/lib/visibility";
import { muteWordsOf } from "@/lib/timeline";

/**
 * 現在の読み手に見えている投稿だけから作る候補。固定のタグ体系や件数は返さない。
 * 非表示の本文・注意文・タグを候補に混ぜないため、必ず userId を渡す。
 */
export async function suggestedTags(circleId: string, userId: string, take = 8): Promise<string[]> {
  const now = new Date();
  const [recent, rules] = await Promise.all([
    prisma.post.findMany({
      where: { circleId, visibility: "circle", deletedAt: null, OR: [{ expiresAt: { gt: now } }, { authorId: userId }] },
      select: {
        authorId: true,
        visibility: true,
        body: true,
        cw: true,
        tags: true,
        expiresAt: true,
        deletedAt: true,
        veils: { where: { userId }, select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    muteWordsOf(userId, circleId),
  ]);
  const visible = recent.filter((post) => {
    if (!isVisibleTo(post, userId, now)) return false;
    if (post.authorId === userId) return true;
    return !veilFor({ body: post.body, cw: post.cw, tags: post.tags }, rules, { selfVeiled: post.veils.length > 0 }).veiled;
  });
  const freq = new Map<string, number>();
  for (const t of visible.flatMap((p) => p.tags)) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([t]) => t);
}
