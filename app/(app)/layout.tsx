import { redirect } from "next/navigation";
import { BottomBar } from "@/components/BottomBar";
import { auth } from "@/lib/auth";

/**
 * 画面の骨。「白い箱」は PC も含めて幅 600px に中央寄せ一列だけ。
 * 左右のレールは出さない（spec「PC は幅 600px で中央に置き、左右のレールは出さない」）。
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  return (
    <>
      <main className="mx-auto w-full max-w-[600px] px-5 pb-32 pt-8">{children}</main>
      <BottomBar />
    </>
  );
}
