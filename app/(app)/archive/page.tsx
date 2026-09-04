import { ActionButton } from "@/components/ActionButton";
import { PostBody } from "@/components/PostCard";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Form } from "@/lib/form";
import { wearOf } from "@/lib/wear";

function isExpired(d: Date) {
  return d.getTime() <= Date.now();
}

export default async function ArchivePage() {
  const userId = (await currentUserId())!;
  const posts = await prisma.post.findMany({
    where: { authorId: userId, deletedAt: null },
    include: { circle: { select: { name: true } }, images: { orderBy: { createdAt: "asc" }, select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return (
    <div>
      <header className="flex flex-col gap-3 border-b border-line pb-4">
        <h1 className="text-[20px] font-bold">じぶんの箱</h1>
        <p className="text-sm leading-[2.1] text-ink-dim">寿命が尽きた紙は消えません。他の人から見えなくなって、ここにもどります。外に出ていた分だけ、しわと雨の跡がついた状態で。</p>
      </header>
      <ul>
        {posts.map((p) => {
          // もどってきた紙は、引き取った時点のいたみのまま止まる（wearOf が expiresAt で止める）
          const wear = wearOf(p.createdAt, p.expiresAt, now);
          const back = isExpired(p.expiresAt);
          return (
            <li key={p.id} style={{ opacity: 1 - wear * 0.4 }} className="border-b border-line py-4">
              <div className="label flex items-baseline gap-3 text-[11px] text-ink-dim">
                <span className="text-ink">{p.circle.name}</span>
                <time className="mono">{p.createdAt.toLocaleDateString("ja-JP")}</time>
                <span className="ml-auto text-ink-faint">{back ? "もどってきた" : "外に出ている"}</span>
              </div>
              {p.cw && <p className="label mt-2 text-[11px] text-ink-faint">注意文　{p.cw}</p>}
              <PostBody form={p.form as Form} body={p.body} imageIds={p.images.map((i) => i.id)} />
              {p.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.tags.map((t) => <span key={t} className="label text-[12px] text-ink-faint"><span className="text-ink-faint/70">#</span>{t}</span>)}
                </div>
              )}
              <div className="label mt-2 flex gap-4 text-[11px] text-ink-faint">
                {!back && (
                  <ActionButton method="PATCH" url={`/api/posts/${p.id}`} body={{ expireNow: true }} className="underline underline-offset-4">いま引き取る</ActionButton>
                )}
                <ActionButton method="DELETE" url={`/api/posts/${p.id}`} className="underline underline-offset-4">完全に消す</ActionButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
