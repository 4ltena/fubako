import { describe, expect, it } from "vitest";
import { wearOf, WEAR_STEPS } from "./wear";

const created = new Date("2026-09-01T00:00:00.000Z");
const expires = new Date("2026-09-08T00:00:00.000Z"); // 7日
const at = (days: number) => new Date(created.getTime() + days * 86400_000);

describe("wearOf", () => {
  it("投げた日はいたんでいない", () => {
    expect(wearOf(created, expires, created)).toBe(0);
  });

  it("外に出ている間、少しずついたむ", () => {
    expect(wearOf(created, expires, at(1))).toBe(1);
    expect(wearOf(created, expires, at(3))).toBe(2);
    expect(wearOf(created, expires, at(5))).toBe(3);
    expect(wearOf(created, expires, at(6.9))).toBe(4);
  });

  it("寿命を過ぎた紙はいたみきった状態で止まる", () => {
    expect(wearOf(created, expires, at(7))).toBe(WEAR_STEPS);
    expect(wearOf(created, expires, at(30))).toBe(WEAR_STEPS);
  });

  it("寿命の幅が無い（すでに切れている）場合もいたみきりで返す", () => {
    expect(wearOf(created, created, at(1))).toBe(WEAR_STEPS);
  });
});
