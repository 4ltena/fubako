import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { AfterwordEditor } from "@/components/AfterwordEditor";
import { LetterPaper } from "@/components/LetterPaper";
import { ExportArchiveButton } from "@/components/ExportArchiveButton";
import { PostBody } from "@/components/PostCard";
import { ARCHIVE_PAGE_SIZE, archiveCursorWhere, archiveDirection, archiveMonth, decodeArchiveCursor, encodeArchiveCursor } from "@/lib/archive";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Form } from "@/lib/form";
import { jstDate, jstMonth, jstMonthRange } from "@/lib/stamp";

type Search = { month?: string; cursor?: string; direction?: string };

function archiveHref(month: string, cursor: string, direction: "older" | "newer") {
  const query = new URLSearchParams({ month });
  query.set("cursor", cursor);
  query.set("direction", direction);
  return `/archive?${query.toString()}`;
}

/** 本人だけの記録。公開期限と会員資格がなくなってもここからは消えない。 */
export default async function ArchivePage({ searchParams }: { searchParams: Promise<Search> }) {
  const userId = (await currentUserId())!;
  const query = await searchParams;
  const now = new Date();
  const requestedMonth = archiveMonth(query.month);
  // 初めて開くときだけ最新の紙を1枚見る。全件を取って月を組み立てない。
  const latest = requestedMonth ? null : await prisma.post.findFirst({
    where: { authorId: userId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true },
  });
  const month = requestedMonth ?? jstMonth(latest?.createdAt ?? now);
  const range = jstMonthRange(month);
  const cursor = decodeArchiveCursor(query.cursor);
  const direction = archiveDirection(query.direction);
  const orderBy = direction === "newer"
    ? [{ createdAt: "asc" as const }, { id: "asc" as const }]
    : [{ createdAt: "desc" as const }, { id: "desc" as const }];
  const posts = range
    ? await prisma.post.findMany({
        where: {
          authorId: userId,
          deletedAt: null,
          createdAt: { gte: range.start, lt: range.end },
          ...archiveCursorWhere(cursor, direction),
        },
        include: {
          circle: { select: { name: true } },
          images: { orderBy: { createdAt: "asc" }, select: { id: true } },
          // DB 内でも最大1件だけ見て真偽値に畳む。人数・誰が反応したかは画面へ渡さない。
          reactions: { where: { userId: { not: userId } }, select: { postId: true }, take: 1 },
        },
        orderBy,
        take: ARCHIVE_PAGE_SIZE + 1,
      })
    : [];
  const hasNext = posts.length > ARCHIVE_PAGE_SIZE;
  const page = hasNext ? posts.slice(0, ARCHIVE_PAGE_SIZE) : posts;
  if (direction === "newer") page.reverse();
  const first = page[0];
  const last = page.at(-1);
  const hasNewer = page.length > 0 && (direction === "newer" ? hasNext : cursor !== null);
  const hasOlder = page.length > 0 && (direction === "older" ? hasNext : cursor !== null);

  return (
    <div>
      <header className="border-b border-line pb-5">
        <h1 className="text-[20px] font-bold">じぶんの箱</h1>
        <p className="mt-3 text-sm leading-[2.1] text-ink-dim">書いた紙は、公開期間が終わってもここに残ります。後書きは自分だけに見えます。</p>
        <form className="mt-5 flex items-end gap-3" action="/archive">
          <label className="label flex min-h-11 flex-col justify-center gap-1 text-[12px] text-ink-dim">年月
            <input name="month" type="month" defaultValue={month} className="min-h-11 border border-line bg-paper px-3 text-[14px] text-ink" />
          </label>
          <button className="label min-h-11 px-3 text-[12px] text-ink underline underline-offset-4">表示する</button>
        </form>
        <ExportArchiveButton month={month} />
      </header>

      {!range || page.length === 0 ? (
        <p className="py-8 text-sm leading-[2.1] text-ink-dim">{month} に書いた紙はまだありません。</p>
      ) : (
        <ul>
          {page.map((post) => (
            <li key={post.id}>
              <LetterPaper createdAt={post.createdAt.toISOString()}>
              <div className="label flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-ink-dim">
                <span className="text-ink">{post.circle.name}</span>
                <time dateTime={post.createdAt.toISOString()}>{jstDate(post.createdAt)}</time>
                <span className="text-ink-dim">{post.visibility === "circle" && post.expiresAt.getTime() > now.getTime() ? "箱で公開中" : "自分だけに表示"}</span>
                {post.reactions.length > 0 && <span className="text-ink-dim">届いています</span>}
              </div>
              {post.cw && <p className="label mt-3 text-[12px] leading-[1.8] text-ink-dim">注意文　{post.cw}</p>}
              <PostBody form={post.form as Form} body={post.body} imageIds={post.images.map((image) => image.id)} />
              {post.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="label text-[12px] text-ink-dim">#{tag}</span>)}</div>}
              <AfterwordEditor postId={post.id} initialAfterword={post.afterword} />
              <div className="label mt-3 flex min-h-11 items-center gap-4 text-[12px] text-ink-dim">
                {post.visibility === "circle" && post.expiresAt.getTime() > now.getTime() && <ActionButton method="PATCH" url={`/api/posts/${post.id}`} body={{ expireNow: true }} className="min-h-11 px-3 underline underline-offset-4">公開を終える</ActionButton>}
                <ActionButton method="DELETE" url={`/api/posts/${post.id}`} confirm={{ title: "この紙を削除しますか", description: "本文と後書きは自分の箱からも見えなくなります。", confirmLabel: "削除", destructive: true }} className="min-h-11 px-3 underline underline-offset-4">削除</ActionButton>
              </div>
              </LetterPaper>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="月内のページ送り" className="label flex min-h-14 items-center justify-between gap-3 py-4 text-[12px]">
        {hasNewer && first && <Link href={archiveHref(month, encodeArchiveCursor({ createdAt: first.createdAt, id: first.id }), "newer")} className="flex min-h-11 items-center px-3 underline underline-offset-4">新しい紙へ</Link>}
        {hasOlder && last && <Link href={archiveHref(month, encodeArchiveCursor({ createdAt: last.createdAt, id: last.id }), "older")} className="ml-auto flex min-h-11 items-center px-3 underline underline-offset-4">前の紙へ</Link>}
      </nav>
    </div>
  );
}
