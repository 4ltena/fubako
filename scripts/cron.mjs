// Vercel Cron の代わり。Docker（Render / Fly.io / VPS）で常駐させてダイジェストを叩く。
//   node scripts/cron.mjs
// vercel.json の cron と同じ時刻（21:00 JST = 12:00 UTC）。両方を同時に有効にしないこと。
import "dotenv/config";
import cron from "node-cron";

const SCHEDULE = process.env.DIGEST_CRON ?? "0 21 * * *";
const base = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET がありません。ダイジェストは動かせません。");
  process.exit(1);
}

async function run() {
  try {
    const r = await fetch(new URL("/api/cron/digest", base), { headers: { authorization: `Bearer ${secret}` } });
    console.log(JSON.stringify({ event: "digest", status: r.status, body: await r.text() }));
  } catch (e) {
    console.error(JSON.stringify({ event: "digest_failed", error: String(e) }));
  }
}

if (process.argv.includes("--once")) {
  await run();
  process.exit(0);
}
cron.schedule(SCHEDULE, run, { timezone: "Asia/Tokyo" });
console.log(JSON.stringify({ event: "cron_started", schedule: SCHEDULE, timezone: "Asia/Tokyo" }));
