import { describe, expect, it } from "vitest";
import { DEFAULT_LIFETIME_MS, defaultExpiresAt, isVisibleTo, shortenExpiry } from "./visibility";

const now = new Date("2026-09-02T00:00:00Z");
const past = new Date(now.getTime() - 1000);
const future = new Date(now.getTime() + 1000);

describe("isVisibleTo", () => {
  const base = { authorId: "me", deletedAt: null };
  it("期限内は誰にでも見える", () => {
    expect(isVisibleTo({ ...base, expiresAt: future }, "other", now)).toBe(true);
  });
  it("期限切れは他人に見えないが本人には見える", () => {
    expect(isVisibleTo({ ...base, expiresAt: past }, "other", now)).toBe(false);
    expect(isVisibleTo({ ...base, expiresAt: past }, "me", now)).toBe(true);
  });
  it("ちょうど期限の瞬間は見えない", () => {
    expect(isVisibleTo({ ...base, expiresAt: now }, "other", now)).toBe(false);
  });
  it("削除済みは本人にも見えない", () => {
    expect(isVisibleTo({ ...base, expiresAt: future, deletedAt: now }, "me", now)).toBe(false);
  });
});

describe("shortenExpiry", () => {
  it("短くはできる", () => {
    expect(shortenExpiry(future, now)).toEqual(now);
  });
  it("伸ばせない", () => {
    expect(shortenExpiry(now, future)).toEqual(now);
  });
});

describe("defaultExpiresAt", () => {
  it("既定は7日後", () => {
    expect(defaultExpiresAt(now).getTime() - now.getTime()).toBe(DEFAULT_LIFETIME_MS);
    expect(DEFAULT_LIFETIME_MS).toBe(7 * 86400_000);
  });
});
