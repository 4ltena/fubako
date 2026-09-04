import { describe, expect, it } from "vitest";
import { boxColor } from "@/lib/boxColor";

describe("boxColor", () => {
  it("同じコードなら同じ色", () => {
    expect(boxColor("あいうえおかきくけこ")).toBe(boxColor("あいうえおかきくけこ"));
  });

  it("違うコードなら違う色になりうる", () => {
    expect(boxColor("あいうえおかきくけこ")).not.toBe(boxColor("さしすせそたちつてと"));
  });

  it("hsl(h 70% 55%) の形で返す", () => {
    expect(boxColor("あいうえおかきくけこ")).toMatch(/^hsl\(\d+ 70% 55%\)$/);
  });
});
