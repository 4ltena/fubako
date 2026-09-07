import assert from "node:assert/strict";
import test from "node:test";
import { validateDeployEnvironment } from "./check-deploy-env.mjs";

const secret = "a".repeat(32);
const valid = {
  DEPLOY_TARGET: "vercel",
  DATABASE_URL: "postgresql://app:password@db.example.test/fubako",
  DATABASE_URL_UNPOOLED: "postgresql://app:password@db-direct.example.test/fubako",
  AUTH_SECRET: secret,
  APP_URL: "https://fubako.example.test",
  AUTH_DISCORD_ID: "discord-client",
  AUTH_DISCORD_SECRET: "discord-secret",
  EMAIL_SERVER: "smtps://mail.example.test:465",
  EMAIL_FROM: "noreply@example.test",
  CRON_SECRET: "b".repeat(32),
  BLOB_READ_WRITE_TOKEN: "c".repeat(32),
};

test("Vercel の完全な環境値を許可する", () => {
  assert.deepEqual(validateDeployEnvironment(valid), { ok: true, errors: [] });
});

test("必須値が無い環境を成功として扱わない", () => {
  const result = validateDeployEnvironment({ DEPLOY_TARGET: "vercel" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes("DATABASE_URL")));
  assert.ok(result.errors.some((message) => message.includes("AUTH_SECRET")));
  assert.ok(result.errors.some((message) => message.includes("APP_URL")));
});

test("認証の片側、弱い秘密、HTTPを拒否する", () => {
  const result = validateDeployEnvironment({
    ...valid,
    AUTH_DISCORD_SECRET: "",
    AUTH_SECRET: "change-me",
    APP_URL: "http://fubako.example.test",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes("Discord")));
  assert.ok(result.errors.some((message) => message.includes("AUTH_SECRET")));
  assert.ok(result.errors.some((message) => message.includes("HTTPS")));
});

test("APP_URL の認証情報を拒否する", () => {
  const result = validateDeployEnvironment({ ...valid, APP_URL: "https://account:password@fubako.example.test" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes("APP_URL")));
});

test("Docker のローカル画像保存には永続マウントの明示が要る", () => {
  const docker = { ...valid, DEPLOY_TARGET: "docker", BLOB_READ_WRITE_TOKEN: "" };
  const missing = validateDeployEnvironment(docker);
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((message) => message.includes("LOCAL_IMAGE_STORAGE_PATH")));
  assert.equal(validateDeployEnvironment({ ...docker, LOCAL_IMAGE_STORAGE_PATH: ".data" }).ok, true);
});
