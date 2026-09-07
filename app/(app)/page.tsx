import Link from "next/link";
import { InviteBoxes } from "@/components/InviteBoxes";
import { boxColor } from "@/lib/boxColor";
import { currentUserId, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DigestPreference } from "@/components/DigestPreference";

export default async function CirclesPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const userId = (await currentUserId())!;
  const missed = (await searchParams).join === "miss";
  const now = new Date();
  const [memberships, user] = await Promise.all([prisma.membership.findMany({
    where: { userId },
    include: {
      circle: {
        include: {
          // 紙が置かれた新しい順に並べるためだけに1枚だけ見る。件数も名前も出さない
          posts: { where: { visibility: "circle", deletedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  }), prisma.user.findUnique({ where: { id: userId }, select: { digestEnabled: true } })]);
  // 新しい紙がある箱が上。文言では何も言わない（急かさない）
  const boxes = memberships.filter((membership) => !membership.archivedAt)
    .map((m) => ({ circle: m.circle, at: m.circle.posts[0]?.createdAt ?? m.joinedAt }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-line pb-4">
        <h1 className="text-[20px] font-bold">ふばこ</h1>
        <p className="text-sm leading-[2.1] text-ink-dim">招待された箱だけが並びます。外からは、この箱があること自体が見えません。</p>
      </header>

      {memberships.length === 0 && (
        <p className="mt-5 text-sm leading-[2.1] text-ink-dim">まだどこにも入っていません。招待リンクから入るか、自分で作ってください。</p>
      )}

      <ul className="mt-2">
        {boxes.map(({ circle }) => (
          <li key={circle.id} className="border-b border-line">
            <Link href={`/c/${circle.id}`} className="flex items-center gap-3 py-4 text-[17px]">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: boxColor(circle.inviteCode) }} />
              {circle.name}
            </Link>
          </li>
        ))}
      </ul>

      {memberships.some((membership) => membership.archivedAt) && (
        <details className="mt-7 border-t border-line pt-4">
          <summary className="label min-h-11 cursor-pointer py-3 text-[11px] text-ink-faint">しまった箱</summary>
          <ul>
            {memberships.filter((membership) => membership.archivedAt).map((membership) => (
              <li key={membership.circleId} className="border-b border-line"><Link href={`/c/${membership.circleId}`} className="flex min-h-11 items-center py-3 text-[15px] text-ink-dim">{membership.circle.name}</Link></li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-8">
        <span className="label text-[11px] text-ink-dim">もらった言葉を入れる</span>
        <div className="mt-3">
          <InviteBoxes from="/" />
        </div>
      </div>
      {missed && <p className="label mt-2 text-[11px] text-ink-faint">その言葉では入れませんでした。もう一度もらってください。</p>}

      <form method="post" action="/api/circles" className="mt-6 flex items-center gap-3 border-b border-line pb-3">
        <input name="name" required maxLength={40} placeholder="新しい箱の名前" className="flex-1 bg-transparent text-[15px] placeholder:text-ink-faint focus:outline-none" />
        <button className="label shrink-0 rounded-full bg-ink px-6 py-2.5 text-xs tracking-[0.1em] text-paper">つくる</button>
      </form>

      <form className="mt-8" action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
        <button className="label text-[11px] text-ink-faint underline underline-offset-4">ログアウト</button>
      </form>
      {user && <div className="mt-6"><DigestPreference initiallyEnabled={user.digestEnabled} /></div>}
    </div>
  );
}
