import { describe, expect, it, vi } from "vitest";
import type { Adapter, AdapterSession } from "@auth/core/adapters";
import { acceptsSessionAuthMethod, isTemporaryLoginAllowed, isUnhostedNextDevelopment, secureSessionAdapter } from "./auth-policy";

const expires = new Date("2026-09-08T00:00:00.000Z");

describe("簡易認証の環境境界", () => {
  // 許可表: `next dev` 相当の未ホストdevelopment+対応する明示フラグだけ許可する。
  // NODE_ENV=test、production、preview、ホストを示す値、NODE_ENV未設定は全て拒否する。
  it.each([
    ["未ホストの開発でPASSWORD_LOGIN=1", { NODE_ENV: "development", PASSWORD_LOGIN: "1" }, "password", true],
    ["未ホストの開発でDEV_LOGIN=1", { NODE_ENV: "development", DEV_LOGIN: "1" }, "dev", true],
    ["別入口のフラグだけ", { NODE_ENV: "development", PASSWORD_LOGIN: "1" }, "dev", false],
    ["productionはフラグに関わらず拒否", { NODE_ENV: "production", PASSWORD_LOGIN: "1", DEV_LOGIN: "1" }, "password", false],
    ["previewはフラグに関わらず拒否", { NODE_ENV: "development", PASSWORD_LOGIN: "1", VERCEL_ENV: "preview" }, "password", false],
    ["hosted環境はフラグに関わらず拒否", { NODE_ENV: "development", DEV_LOGIN: "1", NETLIFY: "true" }, "dev", false],
    ["実行環境が不明なら拒否", { PASSWORD_LOGIN: "1" }, "password", false],
    ["testはnext devではない", { NODE_ENV: "test", DEV_LOGIN: "1" }, "dev", false],
  ] as const)("%s", (_label, env, kind, allowed) => {
    expect(isTemporaryLoginAllowed(kind, env)).toBe(allowed);
  });

  it("ホストを示す値が無い development だけを未ホスト開発と扱う", () => {
    expect(isUnhostedNextDevelopment({ NODE_ENV: "development" })).toBe(true);
    expect(isUnhostedNextDevelopment({ NODE_ENV: "development", VERCEL: "1" })).toBe(false);
  });
});

describe("セッションの出所", () => {
  it("許可されない環境では verified だけを通す", () => {
    const production = { NODE_ENV: "production" };
    expect(acceptsSessionAuthMethod("verified", production)).toBe(true);
    expect(acceptsSessionAuthMethod("demo", production)).toBe(false);
    expect(acceptsSessionAuthMethod("legacy", production)).toBe(false);
    expect(acceptsSessionAuthMethod("unknown", production)).toBe(false);
    expect(acceptsSessionAuthMethod(undefined, production)).toBe(false);
  });

  it("demo は許可済みの未ホスト開発だけを通し、legacy は常に拒否する", () => {
    expect(acceptsSessionAuthMethod("demo", { NODE_ENV: "development" })).toBe(false);
    expect(acceptsSessionAuthMethod("demo", { NODE_ENV: "development", DEV_LOGIN: "1" })).toBe(true);
    expect(acceptsSessionAuthMethod("demo", { NODE_ENV: "development", PASSWORD_LOGIN: "1" })).toBe(true);
    expect(acceptsSessionAuthMethod("demo", { NODE_ENV: "development", DEV_LOGIN: "1", VERCEL: "1" })).toBe(false);
    expect(acceptsSessionAuthMethod("legacy", { NODE_ENV: "development", DEV_LOGIN: "1" })).toBe(false);
    expect(acceptsSessionAuthMethod("unknown", { NODE_ENV: "development", DEV_LOGIN: "1" })).toBe(false);
  });

  it("通常Auth.js発行は verified を明示し、本番ではdemoを返さない", async () => {
    const created: Array<AdapterSession & { authMethod?: string }> = [];
    const base: Adapter = {
      getSessionAndUser: vi.fn(async (token: string) => ({
        session: { sessionToken: token, userId: "u1", expires, authMethod: token },
        user: { id: "u1", email: "u1@example.test", emailVerified: null },
      })),
    };
    const adapter = secureSessionAdapter(
      base,
      async (data) => {
        created.push(data);
        return { sessionToken: data.sessionToken, userId: data.userId, expires: data.expires };
      },
      { NODE_ENV: "production" },
    );

    await adapter.createSession?.({ sessionToken: "new", userId: "u1", expires });
    await expect(adapter.getSessionAndUser?.("demo")).resolves.toBeNull();
    await expect(adapter.getSessionAndUser?.("verified")).resolves.toMatchObject({ session: { sessionToken: "verified" } });
    expect(created).toEqual([{ sessionToken: "new", userId: "u1", expires, authMethod: "verified" }]);
  });
});
