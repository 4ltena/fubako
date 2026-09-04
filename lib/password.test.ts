import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.ts";

describe("hashPassword / verifyPassword", () => {
  it("同じ平文が検証を通る", async () => {
    const hash = await hashPassword("correct horse battery");
    await expect(verifyPassword("correct horse battery", hash)).resolves.toBe(true);
  });

  it("違う平文は通らない", async () => {
    const hash = await hashPassword("correct horse battery");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("ハッシュは毎回違う（salt がランダム）", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
  });
});
