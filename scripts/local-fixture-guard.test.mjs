import test from "node:test";
import assert from "node:assert/strict";
import { assertLocalFixtureEnvironment, isLoopbackDatabaseUrl, isLoopbackUrl } from "./local-fixture-guard.mjs";

const base = {
  NODE_ENV: "development",
  DEV_LOGIN: "1",
  DATABASE_URL: "postgresql://localhost:5432/fubako",
};

test("ローカル開発フィクスチャを許可する", () => {
  assert.doesNotThrow(() => assertLocalFixtureEnvironment(base, { appUrl: "http://127.0.0.1:3000" }));
});

for (const [name, changes] of [
  ["production", { NODE_ENV: "production" }],
  ["フラグなし", { DEV_LOGIN: undefined, PASSWORD_LOGIN: undefined }],
  ["Vercel", { VERCEL_ENV: "preview" }],
  ["外部DB", { DATABASE_URL: "postgresql://db.example.test/fubako" }],
]) {
  test(`危険な環境を拒否する: ${name}`, () => {
    const env = { ...base, ...changes };
    assert.throws(() => assertLocalFixtureEnvironment(env));
  });
}

test("外部のAPP_URLを拒否する", () => {
  assert.throws(() => assertLocalFixtureEnvironment(base, { appUrl: "https://fubako.example.com" }));
});

test("URL判定はループバックだけを受け入れる", () => {
  assert.equal(isLoopbackDatabaseUrl("postgresql://[::1]:5432/fubako"), true);
  assert.equal(isLoopbackDatabaseUrl("postgresql://db.example.test/fubako"), false);
  assert.equal(isLoopbackUrl("http://localhost:3000"), true);
  assert.equal(isLoopbackUrl("https://fubako.example.com"), false);
});
