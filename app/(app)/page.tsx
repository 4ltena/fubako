import Link from "next/link";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CirclesPage() {
  const userId = (await currentUserId())!;
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { circle: true },
    orderBy: { joinedAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">サークル</h1>
      {memberships.length === 0 && <p className="text-ink-soft text-sm">まだどこにも入っていません。招待リンクから入るか、自分で作ってください。</p>}
      <ul className="space-y-2">
        {memberships.map(({ circle }) => (
          <li key={circle.id}>
            <Link href={`/c/${circle.id}`} className="block rounded border border-line bg-card px-4 py-3 hover:border-accent">{circle.name}</Link>
          </li>
        ))}
      </ul>
      <form method="post" action="/api/circles" className="flex gap-2">
        <input name="name" required maxLength={40} placeholder="新しいサークルの名前" className="flex-1 rounded border border-line bg-card px-3 py-2" />
        <button className="rounded bg-accent px-4 py-2 text-paper">作る</button>
      </form>
    </div>
  );
}
