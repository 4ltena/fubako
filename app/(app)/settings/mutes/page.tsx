import { ActionButton } from "@/components/ActionButton";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function MutesPage() {
  const userId = (await currentUserId())!;
  const rules = await prisma.muteRule.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">地雷宣言</h1>
      <p className="text-ink-soft text-sm">ここに登録した語をタグに持つ投稿は、本文を伏せて届きます。1語でも登録すると、タグの無い投稿も「未確認」として伏せられます。</p>
      <form method="post" action="/api/me/mutes" className="flex gap-2">
        <input name="word" required maxLength={40} placeholder="見たくない語" className="flex-1 rounded border border-line bg-card px-3 py-2" />
        <button className="rounded bg-accent px-4 py-2 text-paper">登録</button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-sm">
            {r.word}
            <ActionButton method="DELETE" url={`/api/me/mutes?id=${r.id}`} className="text-ink-soft" aria-label="削除">×</ActionButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
