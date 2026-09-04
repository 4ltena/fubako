import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // マイグレーションは pooler を通さない。Neon の pooler（pgbouncer）越しだと
    // advisory lock が取れず P1002 で止まることがある。実行時のクライアントは
    // lib/db.ts が DATABASE_URL（pooler）を使うので、ここは CLI 専用。
    url: process.env["DATABASE_URL_UNPOOLED"] || process.env["DATABASE_URL"],
    // 空文字を渡すと migrate deploy が P1013 で落ちる（Vercel は未設定の変数を空文字で持つことがある）
    ...(process.env["SHADOW_DATABASE_URL"] ? { shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"] } : {}),
  },
});
