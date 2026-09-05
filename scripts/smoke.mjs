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
await (await A("/c/" + circle.id)).text(); // A が場に来る（ストリーミングなので本文まで読み切る）
const afterPage = await (await B("/c/" + circle.id)).text();
const line = afterPage.match(/<p[^>]*>([^<>]*この場に来た[^<>]*)<\/p>/); // 要素だけを見る（ストリーミングでは RSC の payload が先に並ぶ）
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

// 近いことを書いた人がいます（terms は MeCab 依存なので DB に直接入れて突き合わせだけを見る）
const setTerms = (id, terms) => db.query('UPDATE "Post" SET terms=$1 WHERE id=$2', [terms, id]);
const sX = await mk("ホロライブの配信の話", "推し");
const sZ = await mk("ホロライブの配信のネタバレ", "ネタバレ");
const sY = await (await B("/api/posts", { method: "POST", body: JSON.stringify({ circleId: circle.id, body: "ホロライブのグッズの話", tags: "推し" }) })).json();
await setTerms(sX.id, ["ホロライブ", "配信"]);
await setTerms(sZ.id, ["ホロライブ", "配信"]);
await setTerms(sY.id, ["ホロライブ", "グッズ"]);
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
const simById = Object.fromEntries(tl.map((p) => [p.id, p]));
assert(!JSON.stringify(tl).includes("terms"), "terms は API に出ない");
assert(simById[sX.id].similar?.postId === sY.id, "近い投稿へ1件だけ案内する");
assert(!("similar" in simById[sY.id]), "自分の投稿には出さない");
assert(simById[sZ.id].veiled && !("similar" in simById[sZ.id]), "伏せた投稿には similar が付かない");
assert(!JSON.stringify(simById[sX.id].similar).includes(circle.id) && Object.keys(simById[sX.id].similar).length === 1, "案内は投稿 ID だけで名前も本文も持たない");
const simPage = await (await B("/c/" + circle.id)).text();
assert(simPage.includes("近いことを書いた人がいます") && simPage.includes(`post-${sY.id}`), "画面にも案内が1行だけ出て、飛び先が同じページにある");
assert((await B(`/api/posts/${sY.id}`, { method: "DELETE" })).ok, "案内先を消す");
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
assert(!("similar" in tl.find((p) => p.id === sX.id)), "伏せられる投稿しか残らなければ案内を出さない");

// 伏せた理由の種類と、伏せた紙が持たないもの
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
const kindById = Object.fromEntries(tl.map((p) => [p.id, p]));
assert(kindById[fv.id].kind === "mute" && kindById[sZ.id].kind === "mute", "宣言した語で伏せた紙は kind=mute");
assert(!("tags" in kindById[fv.id]), "伏せた紙はタグを持たない（一致しなかった語も渡さない）");
const cwPost = await mk("注意文の本文", "推し");
await db.query('UPDATE "Post" SET cw=$1 WHERE id=$2', ["写真の話", cwPost.id]);
const noTag = await (await A("/api/posts", { method: "POST", body: JSON.stringify({ circleId: circle.id, body: "タグのない本文2" }) })).json();
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
const k2 = Object.fromEntries(tl.map((p) => [p.id, p]));
assert(k2[cwPost.id].kind === "cw" && k2[cwPost.id].reason === "写真の話", "注意文で伏せた紙は kind=cw");
assert(k2[noTag.id].kind === "unconfirmed" && k2[noTag.id].reason === "未確認", "タグの無い紙は kind=unconfirmed");

// これは伏せておく（読み手が自分のためだけに伏せる。書き手には届かない）
const own = await mk("自分で伏せる用の本文", "ぬいぐるみ");
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
assert(!tl.find((p) => p.id === own.id).veiled, "はじめは開いている");
assert((await B(`/api/posts/${own.id}/veil`, { method: "POST" })).ok, "自分のために伏せる");
tl = (await (await B("/api/posts?circleId=" + circle.id)).json()).posts;
const veiledOwn = tl.find((p) => p.id === own.id);
assert(veiledOwn.veiled && veiledOwn.kind === "self" && !("body" in veiledOwn), "伏せ直した紙は本文を持たない");
assert(!(await (await A("/api/posts?circleId=" + circle.id)).json()).posts.find((p) => p.id === own.id).veiled, "書き手には何も起きない");
assert((await A(`/api/posts/${own.id}/veil`, { method: "POST" })).status === 404, "自分の紙は伏せられない");
assert((await C(`/api/posts/${own.id}/veil`, { method: "POST" })).status === 404, "非会員は伏せられない");
assert((await B(`/api/posts/${own.id}/veil`, { method: "DELETE" })).ok, "伏せたのを戻す");
assert(!(await (await B("/api/posts?circleId=" + circle.id)).json()).posts.find((p) => p.id === own.id).veiled, "戻すと開く");

// 一枚（写真だけの紙）
const onlyImage = new FormData();
onlyImage.set("circleId", circle.id);
onlyImage.set("body", "");
onlyImage.append("images", new Blob([png], { type: "image/png" }), "only.png");
const p5 = await (await A("/api/posts", { method: "POST", body: onlyImage, headers: { "content-type": undefined } })).json();
assert(p5.id, "写真だけでも投げられる");
assert((await (await A("/api/posts?circleId=" + circle.id)).json()).posts.find((p) => p.id === p5.id).form === "picture", "写真だけの紙は形が picture");
const emptyBoth = new FormData();
emptyBoth.set("circleId", circle.id);
emptyBoth.set("body", "  ");
assert((await A("/api/posts", { method: "POST", body: emptyBoth, headers: { "content-type": undefined } })).status === 400, "本文も写真も無ければ投げられない");

// 招待の言葉
assert([...circle.inviteCode].length === 10 && /^[ぁ-ん]+$/.test(circle.inviteCode), "招待の言葉はひらがな10文字");
const E = await sessionFor("e@example.test", "E");
const katakana = circle.inviteCode.replace(/[ぁ-ん]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
assert((await E("/api/circles/join", { method: "POST", body: JSON.stringify({ inviteCode: " " + katakana + " " }) })).ok, "カタカナでも空白つきでも入れる");
assert((await E("/api/circles/join", { method: "POST", body: JSON.stringify({ inviteCode: "あいうえおかきくけこ" }) })).status === 404, "違う言葉では入れない");
const missForm = await E("/api/circles/join", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "inviteCode=あいうえおかきくけこ&from=/" });
assert(missForm.status === 303 && missForm.headers.get("location").includes("join=miss"), "画面から入り損ねたら JSON を出さずに戻す");

// 箱を出る
assert((await E("/api/circles/leave", { method: "POST", body: JSON.stringify({ circleId: circle.id, word: "ちがうことば" }) })).status === 400, "言葉が違えば出られない");
assert((await E("/api/posts?circleId=" + circle.id)).ok, "出られていない");
assert((await E("/api/circles/leave", { method: "POST", body: JSON.stringify({ circleId: circle.id, word: katakana }) })).ok, "言葉を書き写せば出られる");
assert((await E("/api/posts?circleId=" + circle.id)).status === 404, "出たら箱は見えなくなる");
assert((await E("/api/circles/join", { method: "POST", body: JSON.stringify({ inviteCode: circle.inviteCode }) })).ok, "同じ言葉でまた入れる");

// 箱を出たあとも、自分が書いた紙の画像は自分に返る
const withImg = new FormData();
withImg.set("circleId", circle.id);
withImg.set("body", "出たあとに残る写真");
withImg.append("images", new Blob([png], { type: "image/png" }), "keep.png");
const F = await sessionFor("f@example.test", "F");
assert((await F("/api/circles/join", { method: "POST", body: JSON.stringify({ inviteCode: circle.inviteCode }) })).ok, "F が入る");
const fPost = await (await F("/api/posts", { method: "POST", body: withImg, headers: { "content-type": undefined } })).json();
const fImg = (await (await F(`/api/posts/${fPost.id}/reveal`)).json()).imageIds[0];
assert((await F(`/api/images/${fImg}`)).ok, "出る前は自分の画像が取れる");
assert((await F("/api/circles/leave", { method: "POST", body: JSON.stringify({ circleId: circle.id, word: circle.inviteCode }) })).ok, "F が出る");
assert((await F(`/api/images/${fImg}`)).ok, "出たあとも、自分が書いた紙の画像は自分に取れる");
assert((await C(`/api/images/${fImg}`)).status === 404, "非会員は相変わらず取れない");

// 外に飛ばすリダイレクトを受け付けない
const evil = await B("/api/circles/join", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "inviteCode=あいうえおかきくけこ&from=//example.com" });
assert(evil.status === 303 && new URL(evil.headers.get("location"), BASE).origin === BASE, "外部への戻り先は受け付けない");

// 新しい紙が来たかどうか（真偽値だけ・会員だけ）
const nowIso = new Date().toISOString();
const freshBefore = await (await B(`/api/circles/${circle.id}/fresh?since=${encodeURIComponent(nowIso)}`)).json();
assert(freshBefore.fresh === false && Object.keys(freshBefore).length === 1, "新着は真偽値だけを返す");
await mk("新しく置いた紙", "推し");
const freshAfter = await (await B(`/api/circles/${circle.id}/fresh?since=${encodeURIComponent(nowIso)}`)).json();
assert(freshAfter.fresh === true, "他の人が置いたら新着になる");
const mine = await (await B("/api/posts", { method: "POST", body: JSON.stringify({ circleId: circle.id, body: "自分で置いた紙", tags: "推し" }) })).json();
assert(mine.id, "読み手も紙を置く");
const afterMine = await (await B(`/api/circles/${circle.id}/fresh?since=${encodeURIComponent(new Date().toISOString())}`)).json();
assert(afterMine.fresh === false, "自分が置いた紙は新着にしない");
assert((await C(`/api/circles/${circle.id}/fresh?since=${encodeURIComponent(nowIso)}`)).status === 404, "非会員は新着を聞けない");
assert((await B(`/api/circles/${circle.id}/fresh?since=x`)).status === 400, "時刻が壊れていれば 400");

assert((await fetch(BASE + "/api/cron/digest")).status === 401, "cron は秘密なしで 401");
const page = await (await B("/c/" + circle.id)).text();
assert(page.includes("noindex") && !page.includes("og:") && !page.includes("ネタバレ本文") && !page.includes("タグなし本文") && page.includes("無害本文"), "画面 HTML にも伏せた本文が無く noindex");
assert((await (await fetch(BASE + "/robots.txt")).text()).includes("Disallow: /"), "robots.txt");

// パスワードログイン（PASSWORD_LOGIN=1 で動かしたサーバに対してだけ検証する）
const handle = "smoke-" + crypto.randomUUID().slice(0, 8);
const passwordForm = (h, p = "") => new URLSearchParams(p ? { handle: h, password: p } : { handle: h });
// 他サイトからの自動 POST（ログイン CSRF）は弾く
assert((await fetch(BASE + "/api/auth/password", { method: "POST", body: passwordForm(handle), redirect: "manual", headers: { origin: "https://evil.example" } })).status === 403, "別オリジンからのログイン POST は 403");
const firstTry = await fetch(BASE + "/api/auth/password", { method: "POST", body: passwordForm(handle), redirect: "manual" });
if (firstTry.status === 404) {
  assert(true, "PASSWORD_LOGIN 無しでは 404");
} else {
  assert(firstTry.status === 303 && firstTry.headers.get("location").endsWith("/"), "初回は名前だけで作られて入れる");
  const again = await fetch(BASE + "/api/auth/password", { method: "POST", body: passwordForm(handle), redirect: "manual" });
  assert(again.status === 303 && again.headers.get("location").endsWith("/"), "登録済みの名前でまた入れる");
  const lookalike = await fetch(BASE + "/api/auth/password", { method: "POST", body: passwordForm(handle + "\u200b"), redirect: "manual" });
  assert(lookalike.status === 303, "ゼロ幅空白を足した名前も同じアカウント扱いで入れる");
  const rows = await db.query('SELECT count(*)::int AS n FROM "User" WHERE handle = $1', [handle]);
  assert(rows.rows[0].n === 1, "同形の名前で別アカウントは作られない");
  await db.query('DELETE FROM "User" WHERE handle = $1', [handle]);
}

await prisma.$disconnect();
console.log("ALL OK");
