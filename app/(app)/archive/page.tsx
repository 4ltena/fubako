import { ActionButton } from "@/components/ActionButton";
import { PostBody } from "@/components/PostCard";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Form } from "@/lib/form";
import { isFolded, marksOf, paperTexture, wearOf } from "@/lib/wear";

function isExpired(d: Date) {
  return d.getTime() <= Date.now();
}

/** もどってきた紙はいたんだまま重なって残る。角度もいたみ方も一枚ずつ違う（lib/wear.ts）。 */
function paperStyle(id: string, wear: number) {
  return { transform: `rotate(${marksOf(id).tilt.toFixed(2)}deg)`, backgroundImage: paperTexture(id, wear) };
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
      <header className="flex flex-col gap-3 px-1">
        <h1 className="text-2xl tracking-[0.16em]">じぶんの箱</h1>
        <p className="text-sm leading-[2.25] text-ink-soft">寿命が尽きた紙は消えません。他の人から見えなくなって、ここにもどります。外に出ていた分だけ、しわと雨の跡がついた状態で。</p>
      </header>
      <ul className="mt-6 space-y-3">
        {posts.map((p) => {
          // もどってきた紙は、引き取った時点のいたみのまま止まる（wearOf が expiresAt で止める）
          const wear = wearOf(p.createdAt, p.expiresAt, now);
          const back = isExpired(p.expiresAt);
          return (
            <li
              key={p.id}
              style={paperStyle(p.id, wear)}
              className={`relative overflow-hidden rounded-[26px] px-[22px] pb-4 pt-5 ${back ? "bg-veil" : "bg-card shadow-paper"}`}
            >
              {isFolded(wear) && (
                <div
                  aria-hidden
                  className={`pointer-events-none absolute top-0 h-7 w-7 ${marksOf(p.id).foldRight ? "right-0" : "left-0"}`}
                  style={{ background: `linear-gradient(${marksOf(p.id).foldRight ? 225 : 135}deg, var(--color-paper) 48%, rgba(32,30,29,0.07) 50%, transparent 60%)` }}
                />
              )}
              <div className="label flex items-baseline gap-3 text-[11px] tracking-[0.12em] text-ink-soft">
                <span className="text-ink">{p.circle.name}</span>
                <span>{p.createdAt.toLocaleDateString("ja-JP")}</span>
                <span className="ml-auto">{back ? "もどってきた" : "外に出ている"}</span>
              </div>
              {p.cw && <p className="label mt-2 text-[11px] text-ink-faint">注意文　{p.cw}</p>}
              <PostBody form={p.form as Form} body={p.body} imageIds={p.images.map((i) => i.id)} />
              {p.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.tags.map((t) => <span key={t} className="label rounded-full bg-sage px-3 py-[5px] text-[11px] tracking-[0.06em] text-sage-ink">{t}</span>)}
                </div>
              )}
              <div className="label mt-3 flex gap-4 text-[11px] tracking-[0.1em] text-ink-faint">
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
