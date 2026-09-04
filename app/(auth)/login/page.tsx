import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ dev?: string; password?: string }> }) {
  if ((await auth())?.user) redirect("/");
  const sp = await searchParams;
  const stale = sp.dev === "stale";
  const passwordWrong = sp.password === "wrong";
  const discordEnabled = Boolean(process.env.AUTH_DISCORD_ID);
  const emailEnabled = Boolean(process.env.EMAIL_SERVER);
  const passwordLoginEnabled = process.env.PASSWORD_LOGIN === "1";
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pt-16">
      <h1 className="text-3xl leading-[1.6] font-bold">ふばこ</h1>
      {stale && <p className="label mt-4 text-[11px] text-ink-faint">そのリンクはもう使えません。</p>}
      <p className="mt-4 text-sm leading-[2.1] text-ink-dim">招待された人だけが入れる、小さな場。返信欄と DM はありません。反応は一種類だけで、数は誰にも見えません。</p>
      <div className="mt-8 space-y-3">
        {passwordLoginEnabled && (
          <form action="/api/auth/password" method="POST" className="space-y-3">
            {passwordWrong && <p className="label text-[11px] text-ink-faint">名前かパスワードが違います。</p>}
            <input name="handle" required maxLength={20} placeholder="名前" className="w-full border-b border-line bg-transparent px-1 py-3 text-[15px] placeholder:text-ink-faint focus:outline-none" />
            <input name="password" type="password" required minLength={8} placeholder="パスワード（8文字以上）" className="w-full border-b border-line bg-transparent px-1 py-3 text-[15px] placeholder:text-ink-faint focus:outline-none" />
            <button className="label w-full rounded-full bg-ink py-3.5 text-xs tracking-[0.1em] text-paper">入る（はじめてなら、この名前で作られます）</button>
          </form>
        )}
        {discordEnabled && (
          <form action={async () => { "use server"; await signIn("discord", { redirectTo: "/" }); }}>
            <button className="label w-full rounded-full bg-ink py-3.5 text-xs tracking-[0.1em] text-paper">Discord で入る</button>
          </form>
        )}
        {emailEnabled && (
        <form
          className="space-y-3"
          action={async (fd: FormData) => {
            "use server";
            await signIn("nodemailer", { email: String(fd.get("email")), redirectTo: "/" });
          }}
        >
          <input name="email" type="email" required placeholder="メールアドレス" className="w-full border-b border-line bg-transparent px-1 py-3 text-[15px] placeholder:text-ink-faint focus:outline-none" />
          <button className="label w-full rounded-full border border-line-2 py-3.5 text-xs tracking-[0.1em] text-ink-dim">入るためのリンクを送る</button>
        </form>
        )}
      </div>
    </main>
  );
}
