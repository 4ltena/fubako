import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params;
  const userId = await currentUserId();
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/join/${inviteCode}`)}`);
  const circle = await prisma.circle.findUnique({ where: { inviteCode }, include: { _count: { select: { memberships: true } } } });
  if (!circle) notFound();
  const already = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId: circle.id } } });
  if (already) redirect(`/c/${circle.id}`);
  const full = circle._count.memberships >= circle.memberLimit;
  return (
    <main className="mx-auto w-full max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-semibold">{circle.name}</h1>
      {full ? (
        <p className="text-ink-soft text-sm">このサークルは定員に達しています。</p>
      ) : (
        <form method="post" action="/api/circles/join">
          <input type="hidden" name="inviteCode" value={inviteCode} />
          <button className="w-full rounded bg-accent px-4 py-2 text-paper">参加する</button>
        </form>
      )}
    </main>
  );
}
