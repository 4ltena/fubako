import { ActionButton } from "@/components/ActionButton";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function MutesPage() {
  const userId = (await currentUserId())!;
  const rules = await prisma.muteRule.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return (
    <div>
      <header className="flex flex-col gap-4 px-1">
        <h1 className="text-2xl tracking-[0.16em]">見たくない語</h1>
        <p className="text-sm leading-[2.25] text-ink-soft">書いておくと、その語を持つ投稿は本文を伏せたまま届きます。開けるかどうかは、そのとき決めればいい。</p>
      </header>

      <form method="post" action="/api/me/mutes" className="mt-5 flex items-center gap-2.5 rounded-full bg-card p-2 pl-6 shadow-paper">
        <input name="word" required maxLength={40} placeholder="語を書く" className="flex-1 bg-transparent text-[15px] placeholder:text-ink-pale focus:outline-none" />
        <button className="label shrink-0 rounded-full bg-accent px-6 py-3 text-xs tracking-[0.16em] text-card">しまう</button>
      </form>

      {rules.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2.5 rounded-[28px] bg-card p-6 shadow-paper">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3.5 rounded-full bg-veil px-[18px] py-3 text-sm tracking-[0.06em]">
              {r.word}
              <ActionButton method="DELETE" url={`/api/me/mutes?id=${r.id}`} className="label text-[13px] text-ink-soft" aria-label="外す">×</ActionButton>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-3.5 rounded-[28px] bg-sage px-[22px] py-6">
        <span className="label text-[11px] tracking-[0.2em] text-sage-ink">いま起きていること</span>
        <p className="text-[13px] leading-[2.15] text-sage-deep">
          {rules.length > 0
            ? "語を宣言しているので、タグのない投稿も「未確認」として伏せています。判定は安全な側に倒します。書いた人の落ち度ではありません。"
            : "まだ何も宣言していないので、何も伏せていません。書いた人が注意文を付けた投稿だけが伏せて届きます。"}
        </p>
      </div>

      <p className="label mt-6 px-1 text-[11px] tracking-[0.1em] text-ink-faint">漏れていたら、その紙の「…」からその場で伏せられます</p>
    </div>
  );
}
