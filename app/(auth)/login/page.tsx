import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { isTemporaryLoginAllowed } from "@/lib/auth-policy";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ dev?: string; password?: string }> }) {
  if ((await auth())?.user) redirect("/");
  const sp = await searchParams;
  const stale = sp.dev === "stale";
  const passwordWrong = sp.password === "wrong";
  const discordEnabled = Boolean(process.env.AUTH_DISCORD_ID);
  const emailEnabled = Boolean(process.env.EMAIL_SERVER);
  const passwordLoginEnabled = isTemporaryLoginAllowed("password");
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pt-16">
      <h1 className="text-3xl leading-[1.6] font-bold">ふばこ</h1>
      {stale && <p className="label mt-4 text-[11px] text-ink-faint">そのリンクはもう使えません。</p>}
      <p className="mt-4 text-sm leading-[2.1] text-ink-dim">招待された人だけが入れる、小さな場。返信欄と DM はありません。反応は一種類だけで、数は誰にも見えません。</p>
      <div className="mt-8 space-y-3">
        {!passwordLoginEnabled && !discordEnabled && !emailEnabled && (
          <section aria-labelledby="login-unavailable" className="rounded-xl border border-line-2 p-5 text-sm leading-[2.1] text-ink-dim">
            <h2 id="login-unavailable" className="font-bold text-ink">現在、ログインを利用できません</h2>
            <p className="mt-2">ログインの設定が完了していません。招待してくれた方、または運営者にお知らせください。</p>
          </section>
        )}
        {passwordLoginEnabled && (
          <form action="/api/auth/password" method="POST" className="space-y-3">
            <p id="demo-login-notice" className="text-sm leading-[2.1] text-ink-dim">テスト用の入口です。同じ名前を知っている人は同じアカウントに入れます。個人情報は投稿しないでください。</p>
            {passwordWrong && <p className="label text-[11px] text-ink-faint">その名前では入れませんでした。</p>}
            <label htmlFor="login-handle" className="block text-sm text-ink">ユーザー名</label>
            <input id="login-handle" name="handle" autoComplete="username" aria-describedby="demo-login-notice" required maxLength={20} placeholder="名前" className="w-full border-b border-line bg-transparent px-1 py-3 text-[15px] placeholder:text-ink-faint focus:outline-none" />
            <input
              type="password"
              disabled
              aria-disabled="true"
              placeholder="パスワード（テスト中は使いません）"
              className="w-full border-b border-line px-1 py-3 text-[15px] text-ink-faint placeholder:text-ink-faint"
              style={{ backgroundImage: "repeating-linear-gradient(135deg, #ececea 0 6px, #f3f3f1 6px 12px)" }}
            />
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
