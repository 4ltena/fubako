import { redirect } from "next/navigation";
import { BottomBar } from "@/components/BottomBar";
import { auth } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-32 pt-9">{children}</main>
      <BottomBar />
    </>
  );
}
