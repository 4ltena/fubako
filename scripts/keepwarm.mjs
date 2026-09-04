// 発表中に手元で走らせる。4 分おきに /api/health を叩いて、Vercel の関数と Neon を起こしたままにする。
//   APP_URL=https://fubako-one.vercel.app npm run warm
// 止めるときは Ctrl+C。常時は回さない（Neon の無料枠を食う）。
const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const url = `${base}/api/health`;
const INTERVAL_MS = 4 * 60 * 1000;

async function ping() {
  const t = Date.now();
  try {
    const r = await fetch(url, { cache: "no-store" });
    console.log(new Date().toLocaleTimeString("ja-JP"), r.status, `${Date.now() - t}ms`);
  } catch (e) {
    console.log(new Date().toLocaleTimeString("ja-JP"), "失敗", String(e));
  }
}

console.log(`${url} を 4 分おきに叩きます`);
await ping();
setInterval(ping, INTERVAL_MS);
