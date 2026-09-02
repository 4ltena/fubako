import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/");
  const discordEnabled = Boolean(process.env.AUTH_DISCORD_ID);
  return (
    <main className="mx-auto w-full max-w-sm p-6 space-y-6">
      <h1 className="text-2xl font-semibold">ふばこ</h1>
      <p className="text-ink-soft text-sm">招待された人だけが入れる、小さな場。</p>
      {discordEnabled && (
        <form action={async () => { "use server"; await signIn("discord", { redirectTo: "/" }); }}>
          <button className="w-full rounded bg-accent px-4 py-2 text-paper">Discord でログイン</button>
        </form>
      )}
      <form
        className="space-y-2"
        action={async (fd: FormData) => {
          "use server";
          await signIn("nodemailer", { email: String(fd.get("email")), redirectTo: "/" });
        }}
      >
        <input name="email" type="email" required placeholder="メールアドレス" className="w-full rounded border border-line bg-card px-3 py-2" />
        <button className="w-full rounded border border-accent px-4 py-2 text-accent">ログイン用リンクを送る</button>
      </form>
    </main>
  );
}
