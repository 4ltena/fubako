import { describe, expect, it } from "vitest";
import { jstDayKey, presentToday, SEEN_INTERVAL_MS, shouldTouchSeen } from "./presence";

// 2026-09-03 12:00 JST = 2026-09-03 03:00 UTC
const now = new Date("2026-09-03T03:00:00.000Z");
const me = "me";

describe("presentToday", () => {
  it("今日: 自分以外が今日来ていれば真", () => {
    const members = [
      { userId: me, lastSeenAt: null },
      { userId: "other", lastSeenAt: new Date("2026-09-03T02:00:00.000Z") },
    ];
    expect(presentToday(members, me, now)).toBe(true);
  });

  it("昨日: 前日までしか来ていなければ偽", () => {
    // 2026-09-02 23:00 JST = 2026-09-02 14:00 UTC（JST では昨日）
    const members = [{ userId: "other", lastSeenAt: new Date("2026-09-02T14:00:00.000Z") }];
    expect(presentToday(members, me, now)).toBe(false);
  });

  it("自分だけ: 自分が今日来ていても偽", () => {
    const members = [{ userId: me, lastSeenAt: new Date("2026-09-03T02:59:00.000Z") }];
    expect(presentToday(members, me, now)).toBe(false);
  });

  it("未設定: 誰も lastSeenAt を持たなければ偽", () => {
    const members = [
      { userId: me, lastSeenAt: null },
      { userId: "other", lastSeenAt: null },
    ];
    expect(presentToday(members, me, now)).toBe(false);
    expect(presentToday([], me, now)).toBe(false);
  });

  it("JST の境界で切る（UTC の日付では切らない）", () => {
    // 2026-09-03 08:00 JST = 2026-09-02 23:00 UTC。UTC では昨日だが JST では今日
    const members = [{ userId: "other", lastSeenAt: new Date("2026-09-02T23:00:00.000Z") }];
    expect(presentToday(members, me, now)).toBe(true);
    expect(jstDayKey(new Date("2026-09-02T14:59:59.999Z"))).toBe("2026-09-02");
    expect(jstDayKey(new Date("2026-09-02T15:00:00.000Z"))).toBe("2026-09-03");
  });
});

describe("shouldTouchSeen", () => {
  it("未設定なら更新する", () => {
    expect(shouldTouchSeen(null, now)).toBe(true);
  });
  it("間隔未満なら更新しない（連打で DB を叩かない）", () => {
    expect(shouldTouchSeen(new Date(now.getTime() - SEEN_INTERVAL_MS + 1000), now)).toBe(false);
  });
  it("間隔以上経っていれば更新する", () => {
    expect(shouldTouchSeen(new Date(now.getTime() - SEEN_INTERVAL_MS), now)).toBe(true);
  });
});
