import "server-only";
import { prisma } from "@/lib/db";

/** そのサークルでよく使われた語。固定のタグ体系は作らない。件数は返さない。 */
export async function suggestedTags(circleId: string, take = 8): Promise<string[]> {
  const recent = await prisma.post.findMany({
    where: { circleId, deletedAt: null, expiresAt: { gt: new Date() } },
    select: { tags: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const freq = new Map<string, number>();
  for (const t of recent.flatMap((p) => p.tags)) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([t]) => t);
}
