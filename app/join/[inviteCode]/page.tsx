import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeInvite } from "@/lib/invite";

export default async function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params;
  const userId = await currentUserId();
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/join/${inviteCode}`)}`);
  // リンクから来た言葉も、貼り付けと同じように均す（カタカナのまま開いても入れる）
  const circle = await prisma.circle.findUnique({ where: { inviteCode: normalizeInvite(inviteCode) }, include: { _count: { select: { memberships: true } } } });
  if (!circle) notFound();
  const already = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId: circle.id } } });
  if (already) redirect(`/c/${circle.id}`);
  // 定員かどうかだけを見る。人数は画面にも出さない（README「数えない」）。
  const full = circle._count.memberships >= circle.memberLimit;
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pt-16">
      <h1 className="text-2xl leading-[1.6] font-bold">入ろうとしている場</h1>
      <div className="mt-6 border-b border-line pb-7">
        <span className="text-xl">{circle.name}</span>
        <p className="mt-4 text-[13px] leading-[2.1] text-ink-dim">返信欄と DM はありません。反応は一種類だけで、数は誰にも見えません。寿命が来た紙は、書いた人の箱にもどります。</p>
      </div>
      {full ? (
        <p className="mt-5 text-sm leading-[2.1] text-ink-dim">この場はもう入れません。中にいる人に聞いてみてください。</p>
      ) : (
        <form method="post" action="/api/circles/join" className="mt-5">
          <input type="hidden" name="inviteCode" value={inviteCode} />
          <input type="hidden" name="from" value={`/join/${inviteCode}`} />
          <button className="label w-full rounded-full bg-ink py-[16px] text-sm tracking-[0.2em] text-paper">入る</button>
        </form>
      )}
    </main>
  );
}
