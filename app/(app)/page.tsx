import Link from "next/link";
import { InviteBoxes } from "@/components/InviteBoxes";
import { currentUserId, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CirclesPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const userId = (await currentUserId())!;
  const missed = (await searchParams).join === "miss";
  const now = new Date();
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      circle: {
        include: {
          // 紙が置かれた新しい順に並べるためだけに1枚だけ見る。件数も名前も出さない
          posts: { where: { deletedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  // 新しい紙がある箱が上。文言では何も言わない（急かさない）
  const boxes = memberships
    .map((m) => ({ circle: m.circle, at: m.circle.posts[0]?.createdAt ?? m.joinedAt }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  return (
    <div>
      <header className="flex flex-col gap-4 px-1">
        <h1 className="text-2xl tracking-[0.16em]">ふばこ</h1>
        <p className="text-sm leading-[2.25] text-ink-soft">招待された箱だけが並びます。外からは、この箱があること自体が見えません。</p>
      </header>

      {memberships.length === 0 && (
        <p className="mt-5 px-1 text-sm leading-[2.1] text-ink-soft">まだどこにも入っていません。招待リンクから入るか、自分で作ってください。</p>
      )}

      <ul className="mt-5 space-y-3">
        {boxes.map(({ circle }) => (
          <li key={circle.id}>
            <Link href={`/c/${circle.id}`} className="block rounded-[26px] bg-card px-[22px] py-5 text-[17px] tracking-[0.14em] shadow-paper">{circle.name}</Link>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <span className="label text-[11px] tracking-[0.2em] text-ink-soft">もらった言葉を入れる</span>
        <div className="mt-3">
          <InviteBoxes from="/" />
        </div>
      </div>
      {missed && <p className="label mt-2 px-1 text-[11px] tracking-[0.1em] text-ink-faint">その言葉では入れませんでした。もう一度もらってください。</p>}

      <form method="post" action="/api/circles" className="mt-4 flex items-center gap-2.5 rounded-full bg-card p-2 pl-6 shadow-paper">
        <input name="name" required maxLength={40} placeholder="新しい箱の名前" className="flex-1 bg-transparent text-[15px] placeholder:text-ink-pale focus:outline-none" />
        <button className="label shrink-0 rounded-full bg-accent px-6 py-3 text-xs tracking-[0.16em] text-card">つくる</button>
      </form>

      <form className="mt-8 px-1" action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
        <button className="label text-[11px] tracking-[0.14em] text-ink-faint underline underline-offset-4">ログアウト</button>
      </form>
    </div>
  );
}
