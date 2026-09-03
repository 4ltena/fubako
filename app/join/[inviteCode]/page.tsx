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
  // 定員かどうかだけを見る。人数は画面にも出さない（README「数えない」）。
  const full = circle._count.memberships >= circle.memberLimit;
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pt-16">
      <h1 className="text-2xl leading-[1.6] tracking-[0.16em]">入ろうとしている場</h1>
      <div className="mt-6 rounded-[28px] bg-card px-[22px] py-7 shadow-paper">
        <span className="text-xl tracking-[0.14em]">{circle.name}</span>
        <p className="mt-4 text-[13px] leading-[2.15] text-ink-soft">返信欄と DM はありません。反応は一種類だけで、数は誰にも見えません。寿命が来た紙は、書いた人の箱にもどります。</p>
      </div>
      {full ? (
        <p className="mt-5 px-1 text-sm leading-[2.1] text-ink-soft">この場はもう入れません。中にいる人に聞いてみてください。</p>
      ) : (
        <form method="post" action="/api/circles/join" className="mt-5">
          <input type="hidden" name="inviteCode" value={inviteCode} />
          <input type="hidden" name="from" value={`/join/${inviteCode}`} />
          <button className="label w-full rounded-full bg-accent py-[18px] text-sm tracking-[0.3em] text-card shadow-lift">入る</button>
        </form>
      )}
    </main>
  );
}
