import { Prisma } from "@/lib/generated/prisma/client";

/** サークルを対象にする更新は、このロックを最初に取ってから状態を読み直す。 */
export async function lockCircle(tx: Prisma.TransactionClient, circleId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Circle" WHERE "id" = ${circleId} FOR UPDATE`;
  return rows[0] ?? null;
}

export function mayLeaveCircle(isManager: boolean, memberCount: number): boolean {
  return !isManager || memberCount <= 1;
}

export function memberNames<T extends { userId: string; user: { name: string | null } }>(members: T[]) {
  return members.map((member) => ({ id: member.userId, name: member.user.name?.trim() || "名前のない人" }));
}

export const circleActions = ["revoke", "unban", "transfer"] as const;
export type CircleAction = (typeof circleActions)[number];

export function isCircleAction(value: string): value is CircleAction {
  return (circleActions as readonly string[]).includes(value);
}
