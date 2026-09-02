import { ActionButton } from "@/components/ActionButton";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

function isExpired(d: Date) {
  return d.getTime() <= Date.now();
}

export default async function ArchivePage() {
  const userId = (await currentUserId())!;
  const posts = await prisma.post.findMany({
    where: { authorId: userId, deletedAt: null },
    include: { circle: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">自分の記録</h1>
      <p className="text-ink-soft text-sm">期限が過ぎた投稿も、ここにだけ残ります。</p>
      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="rounded border border-line bg-card p-3 text-sm">
            <div className="flex gap-2 text-xs text-ink-soft">
              <span>{p.circle.name}</span>
              <span>{p.createdAt.toLocaleString("ja-JP")}</span>
              <span className="ml-auto">{isExpired(p.expiresAt) ? "期限切れ" : "公開中"}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap">{p.body}</p>
            {p.tags.length > 0 && <p className="mt-1 text-xs text-ink-soft">{p.tags.map((t) => `#${t}`).join(" ")}</p>}
            <div className="mt-2 flex gap-3 text-xs">
              {!isExpired(p.expiresAt) && (
                <ActionButton method="PATCH" url={`/api/posts/${p.id}`} body={{ expireNow: true }} className="text-ink-soft underline">今すぐ他人から消す</ActionButton>
              )}
              <ActionButton method="DELETE" url={`/api/posts/${p.id}`} className="text-ink-soft underline">完全に消す</ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
