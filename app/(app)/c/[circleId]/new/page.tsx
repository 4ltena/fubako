import { notFound } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMember } from "@/lib/timeline";

export default async function NewPostPage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
  const userId = (await currentUserId())!;
  if (!(await isMember(userId, circleId))) notFound();
  // そのサークルでよく使われた語をサジェスト（固定タグ体系は作らない）
  const recent = await prisma.post.findMany({ where: { circleId, deletedAt: null }, select: { tags: true }, orderBy: { createdAt: "desc" }, take: 200 });
  const freq = new Map<string, number>();
  for (const t of recent.flatMap((p) => p.tags)) freq.set(t, (freq.get(t) ?? 0) + 1);
  const suggested = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  return (
    <form method="post" action="/api/posts" className="space-y-4">
      <input type="hidden" name="circleId" value={circleId} />
      <textarea name="body" required maxLength={2000} rows={6} autoFocus placeholder="雑に投げる" className="w-full rounded border border-line bg-card px-3 py-2" />
      <div>
        <input name="tags" list="tag-suggest" placeholder="タグ（空白区切り・任意。無ければ地雷宣言中の人には伏せられます）" className="w-full rounded border border-line bg-card px-3 py-2 text-sm" />
        <datalist id="tag-suggest">{suggested.map((t) => <option key={t} value={t} />)}</datalist>
        {suggested.length > 0 && <p className="mt-1 text-xs text-ink-soft">よく使われている語: {suggested.join("、")}</p>}
      </div>
      <div className="flex items-center gap-3">
        <select name="days" defaultValue="7" className="rounded border border-line bg-card px-2 py-2 text-sm">
          <option value="1">1日で消える</option>
          <option value="3">3日で消える</option>
          <option value="7">7日で消える</option>
        </select>
        <button className="ml-auto rounded bg-accent px-4 py-2 text-paper">投げる</button>
      </div>
    </form>
  );
}
