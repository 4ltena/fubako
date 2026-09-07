import { notFound } from "next/navigation";
import { CircleInviteControls } from "@/components/CircleInviteControls";
import { CircleManageMembers } from "@/components/CircleManageMembers";
import { CircleDescriptionEditor } from "@/components/CircleDescriptionEditor";
import { currentUserId } from "@/lib/auth";
import { memberNames } from "@/lib/circles";
import { prisma } from "@/lib/db";

export default async function CircleManagePage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
  const userId = (await currentUserId())!;
  const [circle, managerMembership] = await Promise.all([
    prisma.circle.findUnique({ where: { id: circleId }, select: { id: true, name: true, description: true, createdById: true, inviteCode: true, invitesEnabled: true } }),
    prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } }, select: { userId: true } }),
  ]);
  if (!circle || circle.createdById !== userId || !managerMembership) notFound();
  const [members, bans] = await Promise.all([
    prisma.membership.findMany({ where: { circleId }, select: { userId: true, user: { select: { name: true } } }, orderBy: { joinedAt: "asc" } }),
    prisma.circleBan.findMany({ where: { circleId }, select: { userId: true, user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  return <div className="space-y-6"><header className="border-b border-line pb-4"><h1 className="text-[20px] font-bold">{circle.name}を整える</h1><p className="mt-2 text-[13px] leading-6 text-ink-dim">参加者の活動や反応は表示しません。</p></header><CircleDescriptionEditor circleId={circleId} initialDescription={circle.description} /><CircleInviteControls circleId={circleId} enabled={circle.invitesEnabled} inviteCode={circle.inviteCode} /><CircleManageMembers circleId={circleId} members={memberNames(members)} bans={memberNames(bans)} managerId={circle.createdById} /></div>;
}
