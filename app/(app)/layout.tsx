import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <>
      <header className="border-b border-line">
        <nav className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold">ふばこ</Link>
          <Link href="/archive" className="text-ink-soft">記録</Link>
          <Link href="/settings/mutes" className="text-ink-soft">地雷宣言</Link>
          <form className="ml-auto" action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="text-ink-soft">ログアウト</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4">{children}</main>
    </>
  );
}
