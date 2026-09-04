import { describe, expect, it } from "vitest";
import { memberLimit } from "./memberLimit";

describe("memberLimit", () => {
  it("未設定・不正な値は 30", () => {
    expect(memberLimit(undefined)).toBe(30);
    expect(memberLimit("")).toBe(30);
    expect(memberLimit("abc")).toBe(30);
    expect(memberLimit("0")).toBe(30);
    expect(memberLimit("-5")).toBe(30);
    expect(memberLimit("2.5")).toBe(30);
  });
  it("正の整数ならその値", () => {
    expect(memberLimit("120")).toBe(120);
  });
});
