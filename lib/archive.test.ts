import { describe, expect, it } from "vitest";
import { archiveCursorWhere, archiveDirection, archiveMonth, decodeArchiveCursor, encodeArchiveCursor } from "./archive";

describe("アーカイブの年月", () => {
  it("YYYY-MM だけを受け付ける", () => {
    expect(archiveMonth("2026-09")).toBe("2026-09");
    expect(archiveMonth("2026-00")).toBeNull();
    expect(archiveMonth("2026-13")).toBeNull();
    expect(archiveMonth("2026-9")).toBeNull();
  });
});

describe("アーカイブのカーソル", () => {
  it("日時と ID を失わずに往復できる", () => {
    const cursor = { createdAt: new Date("2026-09-01T00:00:00.000Z"), id: "post-a" };
    expect(decodeArchiveCursor(encodeArchiveCursor(cursor))).toEqual(cursor);
  });

  it("壊れた値は検索に使わない", () => {
    expect(decodeArchiveCursor("not-a-cursor")).toBeNull();
    expect(decodeArchiveCursor(encodeArchiveCursor({ createdAt: new Date("2026-09-01T00:00:00.000Z"), id: "" }))).toBeNull();
  });

  it("同時刻では ID を使って前後の紙を絞る", () => {
    const cursor = { createdAt: new Date("2026-09-01T00:00:00.000Z"), id: "post-b" };
    expect(archiveCursorWhere(cursor, "older")).toEqual({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: "post-b" } },
      ],
    });
    expect(archiveCursorWhere(cursor, "newer")).toEqual({
      OR: [
        { createdAt: { gt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { gt: "post-b" } },
      ],
    });
  });

  it("前後のカーソルは URL 履歴を持たずに4ページ以上を往復できる", () => {
    const rows = Array.from({ length: 121 }, (_, index) => ({
      id: `post-${String(121 - index).padStart(3, "0")}`,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
    }));
    const page = (cursor: typeof rows[number] | null, direction: "older" | "newer") => {
      const matching = cursor === null
        ? rows
        : rows.filter((row) => direction === "older" ? row.id < cursor.id : row.id > cursor.id);
      const ordered = [...matching].sort((a, b) => direction === "older" ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id));
      const selected = ordered.slice(0, 31).slice(0, 30);
      return direction === "newer" ? selected.reverse() : selected;
    };
    const first = page(null, "older");
    const second = page(first.at(-1)!, "older");
    const third = page(second.at(-1)!, "older");
    const fourth = page(third.at(-1)!, "older");
    expect([first, second, third, fourth].map((p) => p[0].id)).toEqual(["post-121", "post-091", "post-061", "post-031"]);
    const backToThird = page(fourth[0], "newer");
    const backToSecond = page(backToThird[0], "newer");
    expect(backToThird[0].id).toBe("post-061");
    expect(backToSecond[0].id).toBe("post-091");
    expect(archiveDirection("newer")).toBe("newer");
    expect(archiveDirection("other")).toBe("older");
  });
});
