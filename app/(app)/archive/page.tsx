import { ActionButton } from "@/components/ActionButton";
import { PostBody } from "@/components/PostCard";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Form } from "@/lib/form";
import { wearOf, WEAR_STEPS } from "@/lib/wear";

function isExpired(d: Date) {
  return d.getTime() <= Date.now();
}

/** もどってきた紙はいたんだまま重なって残る。角度もいたみ方も一枚ずつ違う。 */
function paperStyle(id: string, wear: number) {
  const seed = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const tilt = ((seed % 5) - 2) * 0.35;
  const crease = 0.010 + wear * 0.006;
  const rain = wear >= 2 ? 0.028 + wear * 0.008 : 0;
  return {
    transform: `rotate(${tilt}deg)`,
    backgroundImage: [
      `linear-gradient(${97 + (seed % 12)}deg, transparent 30%, rgba(32,30,29,${crease}) 44%, transparent 58%)`,
      `linear-gradient(${71 + (seed % 9)}deg, transparent 52%, rgba(32,30,29,${crease * 0.8}) 68%, transparent 82%)`,
      rain > 0 ? `radial-gradient(70px 52px at ${70 + (seed % 20)}% 78%, rgba(100,92,80,${rain}) 0%, transparent 72%)` : "",
    ]
      .filter(Boolean)
      .join(","),
  };
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
          const wear = wearOf(p.createdAt, p.expiresAt, now);
          const back = isExpired(p.expiresAt);
          return (
            <li
              key={p.id}
              style={paperStyle(p.id, back ? WEAR_STEPS : wear)}
              className={`rounded-[26px] px-[22px] pb-4 pt-5 ${back ? "bg-veil" : "bg-card shadow-paper"}`}
            >
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
