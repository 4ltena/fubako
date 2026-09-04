import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  // 環境変数が無い入口は組み込まない。空文字のまま渡すと Nodemailer がビルド時に AuthError を投げる
  providers: [
    ...(process.env.AUTH_DISCORD_ID ? [Discord] : []),
    ...(process.env.EMAIL_SERVER
      ? [Nodemailer({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM })]
      : []),
  ],
  pages: { signIn: "/login" },
});

/** ログイン済みのユーザー ID。未ログインなら null。 */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
