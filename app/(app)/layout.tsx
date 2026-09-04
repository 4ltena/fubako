import { redirect } from "next/navigation";
import { BottomBar } from "@/components/BottomBar";
import { RightRail } from "@/components/RightRail";
import { SideRail } from "@/components/SideRail";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * 画面の骨。
 * - 〜1023px: 一列＋下の帯（デザイン案 1a〜1d）
 * - 1024px から: 左に箱の一覧。下の帯は畳む
 * - 1280px から: 右に「たより」と「宣言している語」（デザイン案 1e）
 * 本文の幅は原本の指定どおり 592px で止め、右側は空けたまま置く。
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const [memberships, mutes] = await Promise.all([
    prisma.membership.findMany({ where: { userId }, select: { circle: { select: { id: true, name: true } } }, orderBy: { joinedAt: "desc" } }),
    prisma.muteRule.findMany({ where: { userId }, select: { word: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <>
      <div className="mx-auto flex w-full max-w-[1280px] justify-center lg:justify-start lg:gap-10 xl:gap-[30px]">
        <SideRail circles={memberships.map((m) => m.circle)} />
        <main className="w-full max-w-[592px] px-5 pb-32 pt-9 lg:pb-16 lg:pl-0 lg:pt-10 xl:pr-0">{children}</main>
        <RightRail words={mutes.map((m) => m.word)} />
      </div>
      <BottomBar />
    </>
  );
}
