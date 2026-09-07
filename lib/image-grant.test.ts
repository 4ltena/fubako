import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IMAGE_GRANT_TTL_MS, issueImageGrant, verifyImageGrant } from "./image-grant";

describe("画像取得許可", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-image-grant-secret";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("発行した本人・投稿・有効期限にだけ使える", () => {
    const now = new Date("2026-09-07T00:00:00.000Z");
    const grant = issueImageGrant("u1", "p1", now);
    expect(verifyImageGrant(grant, "u1", "p1", now)).toBe(true);
    expect(verifyImageGrant(grant, "u2", "p1", now)).toBe(false);
    expect(verifyImageGrant(grant, "u1", "p2", now)).toBe(false);
    expect(verifyImageGrant(grant, "u1", "p1", new Date(now.getTime() + IMAGE_GRANT_TTL_MS))).toBe(false);
  });

  it("改ざん・未知の秘密・秘密未設定を拒否する", () => {
    const grant = issueImageGrant("u1", "p1")!;
    expect(verifyImageGrant(`${grant}x`, "u1", "p1")).toBe(false);
    process.env.AUTH_SECRET = "another-secret";
    expect(verifyImageGrant(grant, "u1", "p1")).toBe(false);
    delete process.env.AUTH_SECRET;
    expect(issueImageGrant("u1", "p1")).toBeNull();
    expect(verifyImageGrant(grant, "u1", "p1")).toBe(false);
  });
});
