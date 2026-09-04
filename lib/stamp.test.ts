import { describe, expect, it } from "vitest";
import { jstStamp } from "./stamp";

// 2026-09-04 12:00 JST = 2026-09-04 03:00 UTC
const now = new Date("2026-09-04T03:00:00.000Z");

describe("jstStamp", () => {
  it("今日の紙は時刻だけ", () => {
    expect(jstStamp(new Date("2026-09-04T02:14:00.000Z"), now)).toBe("11:14");
  });

  it("前の日の紙は日付も添える", () => {
    expect(jstStamp(new Date("2026-09-03T13:14:00.000Z"), now)).toBe("9月3日　22:14");
  });

  it("日付の境界は JST で切る", () => {
    // 2026-09-04 00:30 JST = 2026-09-03 15:30 UTC。UTC では前日だが JST では今日
    expect(jstStamp(new Date("2026-09-03T15:30:00.000Z"), now)).toBe("00:30");
    // 2026-09-03 23:30 JST = 2026-09-03 14:30 UTC
    expect(jstStamp(new Date("2026-09-03T14:30:00.000Z"), now)).toBe("9月3日　23:30");
  });

  it("時刻はゼロ詰めする", () => {
    expect(jstStamp(new Date("2026-09-03T20:05:00.000Z"), now)).toBe("05:05");
  });
});
