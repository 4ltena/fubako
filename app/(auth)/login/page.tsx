import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/");
  const discordEnabled = Boolean(process.env.AUTH_DISCORD_ID);
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pt-16">
      <h1 className="text-3xl leading-[1.6] tracking-[0.16em]">ふばこ</h1>
      <p className="mt-4 text-sm leading-[2.25] text-ink-soft">招待された人だけが入れる、小さな場。返信欄と DM はありません。反応は一種類だけで、数は誰にも見えません。</p>
      <div className="mt-8 space-y-3">
        {discordEnabled && (
          <form action={async () => { "use server"; await signIn("discord", { redirectTo: "/" }); }}>
            <button className="label w-full rounded-full bg-accent py-4 text-xs tracking-[0.2em] text-card shadow-lift">Discord で入る</button>
          </form>
        )}
        <form
          className="space-y-3"
          action={async (fd: FormData) => {
            "use server";
            await signIn("nodemailer", { email: String(fd.get("email")), redirectTo: "/" });
          }}
        >
          <input name="email" type="email" required placeholder="メールアドレス" className="w-full rounded-full bg-card px-6 py-3.5 text-[15px] shadow-paper placeholder:text-ink-pale focus:outline-none" />
          <button className="label w-full rounded-full bg-veil py-4 text-xs tracking-[0.2em] text-ink-soft">入るためのリンクを送る</button>
        </form>
      </div>
    </main>
  );
}
