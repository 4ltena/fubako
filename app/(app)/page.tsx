import Link from "next/link";
import { currentUserId, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CirclesPage() {
  const userId = (await currentUserId())!;
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { circle: true },
    orderBy: { joinedAt: "desc" },
  });
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
        {memberships.map(({ circle }) => (
          <li key={circle.id}>
            <Link href={`/c/${circle.id}`} className="block rounded-[26px] bg-card px-[22px] py-5 text-[17px] tracking-[0.14em] shadow-paper">{circle.name}</Link>
          </li>
        ))}
      </ul>

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
