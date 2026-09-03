import "server-only";
import { prisma } from "@/lib/db";
import type { Form } from "@/lib/form";
import { presentToday, shouldTouchSeen } from "@/lib/presence";
import { pickSimilar } from "@/lib/similar";
import { jstStamp } from "@/lib/stamp";
import { veilFor, type VeilKind } from "@/lib/veil";
import { isVisibleTo } from "@/lib/visibility";

/**
 * 読み手に渡す投稿。伏せた投稿は body と画像 ID を持たない（サーバ側で落とす）。
 * 反応の数は持たない。自分が反応したかだけ持つ。
 *
 * form と similar と tags は伏せた投稿には載せない。形も、近い投稿があることも、
 * 一致しなかった側のタグも、伏せた本文の内容を示してしまうため。
 * terms（形態素）はここから外に出さない。
 */
export type TimelineImage = { blurhash: string; width: number; height: number };

export type TimelinePost = {
  id: string;
  authorName: string;
  mine: boolean;
  createdAt: string;
  /** 画面に出す時刻。サーバ側で JST に固定して作る（端末で組み立てると描き直しが起きる）。 */
  stamp: string;
  expiresAt: string;
  /** 自分の紙が、もう他の人から見えなくなっているか。他人の紙では常に false。 */
  returned: boolean;
  reacted: boolean;
  images: TimelineImage[];
} & (
  | { veiled: false; body: string; imageIds: string[]; form: Form; tags: string[]; similar?: { postId: string } }
  | { veiled: true; reason: string; kind: VeilKind }
);

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
      // terms は突き合わせにだけ使う。返す値には決して載せない（下の common を参照）。
      select: {
        id: true,
        authorId: true,
        body: true,
        cw: true,
        tags: true,
        form: true,
        terms: true,
        createdAt: true,
        expiresAt: true,
        deletedAt: true,
        author: { select: { name: true } },
        reactions: { where: { userId }, select: { userId: true } },
        // 読み手自身が伏せた紙かどうか。自分の行だけを引くので、他人の伏せ直しは1行も読まない
        veils: { where: { userId }, select: { userId: true } },
        images: { orderBy: { createdAt: "asc" }, select: { id: true, blurhash: true, width: true, height: true } },
      },
    }),
    muteWordsOf(userId),
  ]);
  // 伏せ判定を先に済ませてから突き合わせる。伏せられる投稿へは案内しない。
  const entries = posts
    .filter((p) => isVisibleTo(p, userId, now))
    .map((p) => ({
      post: p,
      veil: p.authorId === userId ? ({ veiled: false } as const) : veilFor(p.tags, mutes, p.cw, { selfVeiled: p.veils.length > 0 }),
    }));
  // 突き合わせの相手は、いま読み手のタイムラインに載っている投稿だけ（飛び先の無い案内を出さない）。
  const candidates = entries.map((e) => ({ id: e.post.id, authorId: e.post.authorId, terms: e.post.terms, veiled: e.veil.veiled }));

  return entries
    .map(({ post: p, veil }) => {
      const common = {
        id: p.id,
        authorName: p.author.name ?? "名無し",
        mine: p.authorId === userId,
        createdAt: p.createdAt.toISOString(),
        stamp: jstStamp(p.createdAt, now),
        expiresAt: p.expiresAt.toISOString(),
        returned: p.authorId === userId && p.expiresAt.getTime() <= now.getTime(),
        reacted: p.reactions.length > 0,
        images: p.images.map(({ blurhash, width, height }) => ({ blurhash, width, height })),
      };
      if (veil.veiled) return { ...common, veiled: true as const, reason: veil.reason, kind: veil.kind };
      // 自分の投稿には出さない。相手が伏せられる投稿でも出さない（pickSimilar が落とす）。
      const similar = p.authorId === userId ? null : pickSimilar(candidates.find((c) => c.id === p.id)!, candidates);
      return {
        ...common,
        veiled: false as const,
        body: p.body,
        imageIds: p.images.map((i) => i.id),
        form: p.form as Form,
        tags: p.tags,
        ...(similar ? { similar } : {}),
      };
    });
}
