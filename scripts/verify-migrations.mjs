import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const legacyMigrationPaths = [
  "prisma/migrations/20260902011337_init/migration.sql",
  "prisma/migrations/20260902022721_images_and_cw/migration.sql",
  "prisma/migrations/20260903152538_presence_form_terms/migration.sql",
  "prisma/migrations/20260903174909_post_veil_and_reaction_notified/migration.sql",
  "prisma/migrations/20260904161624_password_login/migration.sql",
];
const refinementMigrationPaths = [
  "prisma/migrations/20260907000000_quiet_refinement/migration.sql",
  "prisma/migrations/20260907100000_quiet_features/migration.sql",
];

function check(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

async function rejects(db, sql) {
  try {
    await db.exec(sql);
    return false;
  } catch {
    return true;
  }
}

const db = new PGlite();
try {
  for (const migrationPath of legacyMigrationPaths) {
    await db.exec(readFileSync(migrationPath, "utf8"));
    console.log(`APPLIED: ${migrationPath}`);
  }

  await db.exec(`
    INSERT INTO "User" ("id", "name", "email", "handle", "passwordHash")
      VALUES ('u1', 'りん', 'rin@example.test', 'rin', 'legacy-hash'),
             ('u2', 'あお', 'ao@example.test', 'ao', NULL);
    INSERT INTO "Session" ("id", "sessionToken", "userId", "expires")
      VALUES ('s1', 'legacy-session', 'u1', '2099-01-01T00:00:00Z');
    INSERT INTO "Circle" ("id", "name", "inviteCode", "createdById")
      VALUES ('c1', '推し箱', 'invite-one', 'u1');
    INSERT INTO "Membership" ("userId", "circleId") VALUES ('u1', 'c1'), ('u2', 'c1');
    INSERT INTO "Post" ("id", "circleId", "authorId", "body", "expiresAt", "tags")
      VALUES ('p1', 'c1', 'u1', '昨日の公演がよかった', '2099-01-01T00:00:00Z', ARRAY['舞台']);
    INSERT INTO "Image" ("id", "postId", "key", "blurhash", "width", "height", "bytes")
      VALUES ('i1', 'p1', 'old/key', 'hash', 100, 80, 1234);
    INSERT INTO "Reaction" ("postId", "userId") VALUES ('p1', 'u2');
    INSERT INTO "PostVeil" ("userId", "postId") VALUES ('u2', 'p1');
    INSERT INTO "MuteRule" ("id", "userId", "word") VALUES ('m1', 'u2', '苦手語');
  `);

  for (const migrationPath of refinementMigrationPaths) {
    await db.exec(readFileSync(migrationPath, "utf8"));
    console.log(`APPLIED: ${migrationPath}`);
  }

  const legacy = await db.query(`
    SELECT u."name", s."sessionToken", s."authMethod", c."description", c."invitesEnabled",
           p."body", p."tags", p."visibility", p."afterword", p."clientRequestId"
      FROM "User" u
      JOIN "Session" s ON s."userId" = u."id"
      JOIN "Circle" c ON c."createdById" = u."id"
      JOIN "Post" p ON p."authorId" = u."id" AND p."circleId" = c."id"
     WHERE p."id" = 'p1'`);
  const row = legacy.rows[0];
  check(row.name === "りん" && row.sessionToken === "legacy-session" && row.body === "昨日の公演がよかった",
    "既存の利用者、セッション、投稿データを保持する");
  check(row.authMethod === "legacy" && row.invitesEnabled === true && row.afterword === "" && row.clientRequestId === null,
    "既存行の旧移行既定値を保持する");
  check(row.description === "" && row.visibility === "circle" && JSON.stringify(row.tags) === JSON.stringify(["舞台"]),
    "新しい箱説明と公開状態の既定値を既存行へ適用する");

  await db.exec(`INSERT INTO "TopicMute" ("id", "userId", "circleId", "word", "normalizedWord")
    VALUES ('tm1', 'u2', 'c1', '本編', '本編')`);
  check(await rejects(db, `INSERT INTO "TopicMute" ("id", "userId", "circleId", "word", "normalizedWord")
    VALUES ('tm2', 'u2', 'c1', '本編の別表記', '本編')`), "同じ利用者・箱・正規化語の話題伏せを重複登録できない");
  check(await rejects(db, `INSERT INTO "TopicMute" ("id", "userId", "circleId", "word", "normalizedWord")
    VALUES ('tm3', 'missing-user', 'c1', '未確認', '未確認')`), "話題伏せは存在しない利用者を参照できない");
  check(await rejects(db, `INSERT INTO "TopicMute" ("id", "userId", "circleId", "word", "normalizedWord")
    VALUES ('tm4', 'u2', 'missing-circle', '未確認', '未確認')`), "話題伏せは存在しない箱を参照できない");

  await db.exec(`INSERT INTO "Post" ("id", "circleId", "authorId", "body", "expiresAt", "visibility", "clientRequestId")
    VALUES ('p2', 'c1', 'u1', '自分だけの記録', '2099-01-01T00:00:00Z', 'private', 'req-private')`);
  const privatePost = await db.query(`SELECT "visibility" FROM "Post" WHERE "id" = 'p2'`);
  check(privatePost.rows[0].visibility === "private", "private 公開状態を保存できる");
  check(await rejects(db, `INSERT INTO "Post" ("id", "circleId", "authorId", "body", "expiresAt", "visibility", "clientRequestId")
    VALUES ('p3', 'c1', 'u1', '不正な公開状態', '2099-01-01T00:00:00Z', 'unknown', 'req-invalid')`), "PostVisibility enum は未知の公開状態を拒否する");
  check(await rejects(db, `INSERT INTO "Post" ("id", "circleId", "authorId", "body", "expiresAt", "clientRequestId")
    VALUES ('p4', 'c1', 'u1', '重複送信', '2099-01-01T00:00:00Z', 'req-private')`), "送信識別子の既存一意制約を保持する");

  await db.exec(`DELETE FROM "Circle" WHERE "id" = 'c1'`);
  const cascades = await db.query(`SELECT
    (SELECT count(*) FROM "TopicMute") AS topic_mutes,
    (SELECT count(*) FROM "Post") AS posts,
    (SELECT count(*) FROM "Image") AS images,
    (SELECT count(*) FROM "Membership") AS memberships`);
  check(Object.values(cascades.rows[0]).every((count) => Number(count) === 0),
    "箱の削除時に話題伏せと箱に属する既存行を連鎖削除する");

  console.log("RESULT: 移行互換性の検証に成功しました");
} finally {
  await db.close();
}
