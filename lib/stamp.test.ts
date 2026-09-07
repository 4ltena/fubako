import { describe, expect, it } from "vitest";
import { jstStamp, jstDate, jstDateLine, jstMonth, jstMonthRange } from "./stamp";

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

describe("日付と年月の境界", () => {
  it("UTCでは前年でも、JSTの年・月・曜日で表示する", () => {
    const at = new Date("2025-12-31T15:00:00Z");
    expect(jstMonth(at)).toBe("2026-01");
    expect(jstDate(at)).toBe("2026年1月1日");
    expect(jstDateLine(at)).toBe("2026年1月1日　木曜");
  });
  it("閏月と年越しの期間をUTCへ変換する", () => {
    expect(jstMonthRange("2024-02")).toEqual({ start: new Date("2024-01-31T15:00:00Z"), end: new Date("2024-02-29T15:00:00Z") });
    expect(jstMonthRange("2026-12")?.end).toEqual(new Date("2026-12-31T15:00:00Z"));
  });
  it("不正な年月を正規化して別の月へ流さない", () => {
    for (const month of ["2026-00", "2026-13", "2026-1", "0026-01", "2026-01-01", ""]) expect(jstMonthRange(month)).toBeNull();
  });
});
