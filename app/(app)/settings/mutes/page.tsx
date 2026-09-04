import { ActionButton } from "@/components/ActionButton";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function MutesPage() {
  const userId = (await currentUserId())!;
  const rules = await prisma.muteRule.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-line pb-4">
        <h1 className="text-[20px] font-bold">見たくない語</h1>
        <p className="text-sm leading-[2.1] text-ink-dim">書いておくと、その語を持つ投稿は本文を伏せたまま届きます。開けるかどうかは、そのとき決めればいい。</p>
      </header>

      <form method="post" action="/api/me/mutes" className="mt-5 flex items-center gap-3 border-b border-line pb-3">
        <input name="word" required maxLength={40} placeholder="語を書く" className="flex-1 bg-transparent text-[15px] placeholder:text-ink-faint focus:outline-none" />
        <button className="label shrink-0 rounded-full bg-ink px-6 py-2.5 text-xs tracking-[0.1em] text-paper">しまう</button>
      </form>

      {rules.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2.5 border-b border-line py-4">
          {rules.map((r) => (
            <li key={r.id} className="label flex items-center gap-3 rounded-full border border-line-2 px-4 py-2 text-sm">
              {r.word}
              <ActionButton method="DELETE" url={`/api/me/mutes?id=${r.id}`} className="text-ink-dim" aria-label="外す">×</ActionButton>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-3 border-b border-line pb-4">
        <span className="label text-[11px] text-ink-dim">いま起きていること</span>
        <p className="text-[13px] leading-[2.1] text-ink-dim">
          {rules.length > 0
            ? "語を宣言しているので、タグのない投稿も「未確認」として伏せています。判定は安全な側に倒します。書いた人の落ち度ではありません。"
            : "まだ何も宣言していないので、何も伏せていません。書いた人が注意文を付けた投稿だけが伏せて届きます。"}
        </p>
      </div>

      <p className="label mt-6 text-[11px] text-ink-faint">漏れていたら、その紙の「…」からその場で伏せられます</p>
    </div>
  );
}
