// 開発用スモーク: 2 ユーザーのセッションを DB に直接作り、API を通しで叩く
import "dotenv/config";
import pg from "pg";
import sharp from "sharp";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const prisma = {
  user: { upsert: async ({ where: { email }, create: { name } }) => (await db.query('INSERT INTO "User"(id,email,name) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING *', [crypto.randomUUID(), email, name])).rows[0] },
  session: { create: async ({ data: d }) => (await db.query('INSERT INTO "Session"(id,"sessionToken","userId",expires) VALUES($1,$2,$3,$4) RETURNING *', [crypto.randomUUID(), d.sessionToken, d.userId, d.expires])).rows[0] },
  post: { findUnique: async ({ where: { id } }) => (await db.query('SELECT * FROM "Post" WHERE id=$1', [id])).rows[0] },
  $disconnect: () => db.end(),
};
const BASE = "http://localhost:3000";
const expires = new Date(Date.now() + 86400e3);
async function sessionFor(email, name) {
  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name } });
  const s = await prisma.session.create({ data: { userId: user.id, sessionToken: crypto.randomUUID(), expires } });
  return (path, init = {}) => {
    const headers = Object.fromEntries(Object.entries({ cookie: `authjs.session-token=${s.sessionToken}`, "content-type": "application/json", ...(init.headers ?? {}) }).filter(([, v]) => v !== undefined));
    return fetch(BASE + path, { ...init, headers, redirect: "manual" });
  };
}
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } console.log("ok:", m); };
await db.query(`DELETE FROM "Circle" WHERE "createdById" IN (SELECT id FROM "User" WHERE email LIKE '%@example.test')`);
await db.query(`DELETE FROM "User" WHERE email LIKE '%@example.test'`);
const A = await sessionFor("a@example.test", "A"), B = await sessionFor("b@example.test", "B");
assert((await fetch(BASE + "/api/posts?circleId=x")).status === 401, "未ログインは 401");
const circle = await (await A("/api/circles", { method: "POST", body: JSON.stringify({ name: "テスト" }) })).json();
assert(circle.id && circle.inviteCode, "サークル作成");
assert((await B("/api/posts?circleId=" + circle.id)).status === 404, "非会員には存在が見えない");
assert((await B("/api/circles/join", { method: "POST", body: JSON.stringify({ inviteCode: circle.inviteCode }) })).ok, "招待コードで参加");
const p1 = await (await A("/api/posts", { method: "POST", body: JSON.stringify({ circleId: circle.id, body: "ネタバレ本文", tags: "ネタバレ #最終回", days: "30" }) })).json();
const p2 = await (await A("/api/posts", { method: "POST", body: JSON.stringify({ circleId: circle.id, body: "タグなし本文" }) })).json();
const p3 = await (await A("/api/posts", { method: "POST", body: JSON.stringify({ circleId: circle.id, body: "無害本文", tags: "推し" }) })).json();
let tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
assert(tl.length === 3 && tl.every((p) => !p.veiled && p.body), "地雷宣言なしなら全部開いている");
const dbP1 = await prisma.post.findUnique({ where: { id: p1.id } });
assert(dbP1.expiresAt.getTime() - dbP1.createdAt.getTime() <= 7 * 86400e3, "寿命 30 日指定は 7 日に丸められる");
assert((await B("/api/me/mutes", { method: "POST", body: JSON.stringify({ word: "ねたばれ".normalize("NFKC") === "ねたばれ" ? "ネタバレ" : "x" }) })).ok, "地雷宣言");
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
const byId = Object.fromEntries(tl.map((p) => [p.id, p]));
assert(byId[p1.id].veiled && byId[p1.id].reason === "ネタバレ" && !("body" in byId[p1.id]), "一致タグは伏せられ本文が無い");
assert(byId[p2.id].veiled && byId[p2.id].reason === "未確認" && !("body" in byId[p2.id]), "未タグは未確認で伏せられる");
assert(!byId[p3.id].veiled && byId[p3.id].body === "無害本文", "無害タグは開いている");
assert((await (await B(`/api/posts/${p1.id}/reveal`)).json()).body === "ネタバレ本文", "reveal で本文が取れる");
assert((await (await B(`/api/posts/${p1.id}/react`, { method: "POST" })).json()).reacted === true, "反応を付ける");
assert((await (await B(`/api/posts/${p1.id}/react`, { method: "POST" })).json()).reacted === false, "反応を外す");
assert((await B(`/api/posts/${p1.id}`, { method: "PATCH", body: JSON.stringify({ expiresAt: new Date(Date.now() + 365 * 86400e3).toISOString() }) })).status === 404, "他人の投稿は触れない");
const r = await (await A(`/api/posts/${p1.id}`, { method: "PATCH", body: JSON.stringify({ expiresAt: new Date(Date.now() + 365 * 86400e3).toISOString() }) })).json();
assert(r.expiresAt === byId[p1.id].expiresAt, "寿命は伸ばせない");
await A(`/api/posts/${p1.id}`, { method: "PATCH", body: JSON.stringify({ expireNow: true }) });
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
assert(!tl.some((p) => p.id === p1.id), "期限切れは他人から消える");
assert((await B(`/api/posts/${p1.id}/reveal`)).status === 404, "期限切れは reveal もできない");
tl = (await (await A("/api/posts?circleId=" + circle.id)).json()).posts;
assert(tl.some((p) => p.id === p1.id && p.body), "本人には期限切れでも見える");
assert((await A(`/api/posts/${p2.id}`, { method: "DELETE" })).ok, "削除");
assert(!((await (await A("/api/posts?circleId=" + circle.id)).json()).posts.some((p) => p.id === p2.id)), "削除後は本人にも見えない");
// 画像と注意文
const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#e03030" } }).png().toBuffer();
const form = new FormData();
form.set("circleId", circle.id);
form.set("body", "画像つき本文");
form.set("cw", "写真あり");
form.append("images", new Blob([png], { type: "image/png" }), "a.png");
form.append("images", new Blob([png], { type: "image/png" }), "b.png");
const p4 = await (await A("/api/posts", { method: "POST", body: form, headers: { "content-type": undefined } })).json();
assert(p4.id, "画像つき投稿を作る");
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
const v4 = tl.find((p) => p.id === p4.id);
assert(v4.veiled && v4.reason === "写真あり" && !("body" in v4) && !("imageIds" in v4), "注意文つきは地雷宣言に関係なく伏せられ、本文も画像 ID も無い");
assert(v4.images.length === 2 && v4.images.every((i) => i.blurhash && i.width === 300 && !("id" in i) && !("url" in i)), "伏せた投稿には blurhash と寸法だけがある");
assert(!JSON.stringify(v4).includes("/api/images/"), "伏せた応答に取得先が無い");
const opened = await (await B(`/api/posts/${p4.id}/reveal`)).json();
assert(opened.body === "画像つき本文" && opened.imageIds.length === 2, "reveal で本文と画像 ID が取れる");
const img = await B(`/api/images/${opened.imageIds[0]}`);
assert(img.ok && img.headers.get("content-type") === "image/webp" && img.headers.get("cache-control").includes("private") && img.headers.get("x-robots-tag") === "noindex", "画像本体が WebP で取れる");
const C = await sessionFor("c@example.test", "C");
assert((await C(`/api/images/${opened.imageIds[0]}`)).status === 404, "非会員は画像を取れない");
await A(`/api/posts/${p4.id}`, { method: "PATCH", body: JSON.stringify({ expireNow: true }) });
assert((await B(`/api/images/${opened.imageIds[0]}`)).status === 404, "期限切れの画像は他人から取れない");
assert((await A(`/api/images/${opened.imageIds[0]}`)).ok, "期限切れでも本人は画像を取れる");
assert((await A(`/api/posts/${p4.id}`, { method: "DELETE" })).ok, "画像つき投稿を消す");
assert((await A(`/api/images/${opened.imageIds[0]}`)).status === 404, "削除後は本人も画像を取れない");
const tooBig = new FormData();
tooBig.set("circleId", circle.id);
tooBig.set("body", "大きすぎ");
tooBig.append("images", new Blob([Buffer.alloc(4.5 * 1024 * 1024)], { type: "image/png" }), "big.png");
assert((await A("/api/posts", { method: "POST", body: tooBig, headers: { "content-type": undefined } })).status === 413, "4MB 超は 413");
// 今日の気配（人単位で見せない）
const beforePage = await (await B("/c/" + circle.id)).text();
assert(!beforePage.includes("今日、この場に来た人がいます"), "自分しか来ていない日は気配を出さない");
await A("/c/" + circle.id); // A が場に来る
const afterPage = await (await B("/c/" + circle.id)).text();
const line = afterPage.match(/>([^<>]*この場に来た[^<>]*)</);
assert(line && line[1] === "今日、この場に来た人がいます", "今日来た人がいれば1行だけ出る（名前も数字も混ぜない）");
assert(!/lastSeenAt/.test(JSON.stringify((await (await B("/api/posts?circleId=" + circle.id)).json()))), "lastSeenAt は API に出ない");

// 投稿の形（書き手に選ばせず自動で決める）
const mk = async (body, tags) => (await (await A("/api/posts", { method: "POST", body: JSON.stringify({ circleId: circle.id, body, tags }) })).json());
const f1 = await mk("配信の最後に手を振った", "推し");
const f2 = await mk(["夜が明ける", "推しの声", "まだ耳に"].join("\n"), "推し");
const f3 = await mk("あ".repeat(41), "推し");
const fv = await mk("形を持たない本文", "ネタバレ");
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
const formById = Object.fromEntries(tl.map((p) => [p.id, p]));
assert(formById[f1.id].form === "sentence" && formById[f2.id].form === "verse" && formById[f3.id].form === "text", "形が本文から自動で決まる");
assert(formById[fv.id].veiled && !("form" in formById[fv.id]), "伏せた投稿は形を持たない");

assert((await fetch(BASE + "/api/cron/digest")).status === 401, "cron は秘密なしで 401");
const page = await (await B("/c/" + circle.id)).text();
assert(page.includes("noindex") && !page.includes("og:") && !page.includes("ネタバレ本文") && !page.includes("タグなし本文") && page.includes("無害本文"), "画面 HTML にも伏せた本文が無く noindex");
assert((await (await fetch(BASE + "/robots.txt")).text()).includes("Disallow: /"), "robots.txt");
await prisma.$disconnect();
console.log("ALL OK");
