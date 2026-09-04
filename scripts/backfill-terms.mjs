// 既存投稿に terms を入れる。作成時にしか語を取らないので、後から1回だけ流す。
//   node scripts/backfill-terms.mjs
// MeCab が無い環境では何もせず終わる（空の terms で上書きしない）。
import "dotenv/config";
import pg from "pg";
import { tokenize, userDictFrom } from "../lib/morph.ts";
import { extractTerms, RECENT_BODIES } from "../lib/similar.ts";

if ((await tokenize("推しの新曲が良かった")).length === 0) {
  console.error("MeCab が無いか呼べません。何もせず終わります。");
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows: posts } = await db.query(
  `SELECT id, "circleId", "authorId", body, "createdAt" FROM "Post"
   WHERE "deletedAt" IS NULL AND (terms IS NULL OR cardinality(terms) = 0)
   ORDER BY "createdAt" ASC`,
);
console.log(`対象: ${posts.length} 件`);

const dicts = new Map();
let filled = 0;
for (const p of posts) {
  if (!dicts.has(p.circleId)) {
    const { rows } = await db.query(`SELECT DISTINCT unnest(tags) AS tag FROM "Post" WHERE "circleId" = $1 AND "deletedAt" IS NULL`, [p.circleId]);
    dicts.set(p.circleId, await userDictFrom(rows.map((r) => r.tag)));
  }
  const { rows: recent } = await db.query(
    `SELECT body FROM "Post" WHERE "authorId" = $1 AND "circleId" = $2 AND "deletedAt" IS NULL AND "createdAt" < $3
     ORDER BY "createdAt" DESC LIMIT $4`,
    [p.authorId, p.circleId, p.createdAt, RECENT_BODIES],
  );
  const terms = await extractTerms(p.body, recent.map((r) => r.body), { userDict: dicts.get(p.circleId) });
  await db.query(`UPDATE "Post" SET terms = $1 WHERE id = $2`, [terms, p.id]);
  if (terms.length > 0) filled++;
}
console.log(`語が入った投稿: ${filled} 件`);
await db.end();
