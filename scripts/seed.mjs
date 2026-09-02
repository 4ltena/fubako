// 開発用の仮データ。メールアドレスは *@example.test で、実在しないドメインに固定する。
// 同じアドレスは作り直す（冪等）。各ユーザーのセッションクッキーを出力するので、
// SMTP 無しでもブラウザの Cookie に貼ればそのユーザーとしてログインできる。
import "dotenv/config";
import pg from "pg";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const id = () => crypto.randomUUID();
const days = (n) => new Date(Date.now() + n * 86400e3).toISOString(); // timestamp 列へは UTC の壁時計で入れる

const USERS = [
  { email: "hinata@example.test", name: "ひなた" },
  { email: "sora@example.test", name: "そら" },
  { email: "rin@example.test", name: "りん" },
  { email: "yuu@example.test", name: "ゆう" },
  { email: "nao@example.test", name: "なお" },
];

await db.query(`DELETE FROM "Circle" WHERE "createdById" IN (SELECT id FROM "User" WHERE email LIKE '%@example.test')`);
await db.query(`DELETE FROM "User" WHERE email LIKE '%@example.test'`);

const users = {};
for (const u of USERS) {
  const { rows } = await db.query(`INSERT INTO "User"(id,email,name,"emailVerified") VALUES($1,$2,$3,now()) RETURNING id`, [id(), u.email, u.name]);
  users[u.email] = rows[0].id;
}
const [hinata, sora, rin, yuu] = USERS.map((u) => users[u.email]);

const circleId = id();
await db.query(`INSERT INTO "Circle"(id,name,"inviteCode","createdById") VALUES($1,$2,$3,$4)`, [circleId, "同担のへや", "seed-invite-code", hinata]);
for (const uid of [hinata, sora, rin, yuu]) await db.query(`INSERT INTO "Membership"("userId","circleId") VALUES($1,$2)`, [uid, circleId]);
// nao はどこにも入っていない（招待リンク http://localhost:3000/join/seed-invite-code を試す用）

const POSTS = [
  [hinata, "今日の配信の最後の曲、泣いた", ["配信"], 7],
  [sora, "最終回の展開、正直言うと……（本文はネタバレ）", ["ネタバレ", "最終回"], 7],
  [rin, "グッズ届いた。アクスタの出来がいい", [], 7],
  [yuu, "次のイベント誰か行く？", ["イベント"], 3],
  [sora, "ちょっと愚痴。運営の告知が遅い", ["愚痴"], 1],
  [hinata, "先週の投稿。もう他の人には見えていない", ["配信"], -1],
  [yuu, "注意文つき。開くまで誰にも本文が見えない", ["イベント"], 7, "会場の写真の話"],
];
const postIds = [];
for (const [author, body, tags, d, cw = null] of POSTS) {
  const pid = id();
  postIds.push(pid);
  await db.query(`INSERT INTO "Post"(id,"circleId","authorId",body,tags,"expiresAt","createdAt",cw) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [pid, circleId, author, body, tags, days(d), days(d - 7), cw]);
}
// 地雷宣言: りんは「ネタバレ」と「愚痴」を見たくない。ゆうは何も宣言していない
for (const w of ["ネタバレ", "愚痴"]) await db.query(`INSERT INTO "MuteRule"(id,"userId",word) VALUES($1,$2,$3)`, [id(), rin, w]);
// 反応
await db.query(`INSERT INTO "Reaction"("postId","userId") VALUES($1,$2),($1,$3)`, [postIds[0], sora, rin]);
await db.query(`INSERT INTO "Reaction"("postId","userId") VALUES($1,$2)`, [postIds[2], hinata]);

console.log("サークル: 同担のへや  招待: http://localhost:3000/join/seed-invite-code\n");
const base = process.env.APP_URL ?? "http://localhost:3000";
console.log("ログイン用リンク（ブラウザに貼るだけでそのユーザーとして入る。開発時のみ有効）");
for (const u of USERS) {
  const token = id();
  await db.query(`INSERT INTO "Session"(id,"sessionToken","userId",expires) VALUES($1,$2,$3,$4)`, [id(), token, users[u.email], days(30)]);
  console.log(`  ${u.name.padEnd(4, "　")} ${u.email.padEnd(22)} ${base}/api/dev/login?token=${token}`);
}
await db.end();
