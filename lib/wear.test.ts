import { describe, expect, it } from "vitest";
import { FULL_WEAR_MS, isFolded, marksOf, paperTexture, wearOf } from "./wear";

const created = new Date("2026-09-01T00:00:00.000Z");
const at = (days: number) => new Date(created.getTime() + days * 86400_000);
const expires7 = at(7);

describe("wearOf", () => {
  it("投げた日はいたんでいない", () => {
    expect(wearOf(created, expires7, created)).toBe(0);
  });

  it("外に出ている日数が長いほど進む", () => {
    const days = [1, 2, 3, 5, 6].map((d) => wearOf(created, expires7, at(d)));
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(days[0]).toBeLessThan(days[4]);
    expect(wearOf(created, expires7, at(7))).toBe(1);
  });

  it("寿命を過ぎても、それ以上はいたまない", () => {
    expect(wearOf(created, expires7, at(30))).toBe(1);
    expect(wearOf(created, expires7, at(365))).toBe(1);
  });

  it("手元に引き取ったら、その時点で止まる", () => {
    // 2日目に「いま引き取る」で寿命を切った紙
    const pulledBack = at(2);
    const atPullback = wearOf(created, pulledBack, at(2));
    expect(wearOf(created, pulledBack, at(3))).toBe(atPullback);
    expect(wearOf(created, pulledBack, at(100))).toBe(atPullback);
    // 7日出ていた紙より浅い
    expect(atPullback).toBeLessThan(wearOf(created, expires7, at(7)));
  });

  it("寿命が短い紙は、出ていた分だけしかいたまない", () => {
    const oneDay = at(1);
    expect(wearOf(created, oneDay, at(5))).toBeCloseTo(86400_000 / FULL_WEAR_MS, 5);
  });
});

describe("marksOf", () => {
  it("同じ紙はいつ見ても同じいたみ方（乱数を使わない）", () => {
    expect(marksOf("post-abc")).toEqual(marksOf("post-abc"));
    expect(paperTexture("post-abc", 0.5)).toBe(paperTexture("post-abc", 0.5));
  });

  it("紙ごとにいたみ方が違う", () => {
    expect(marksOf("post-abc")).not.toEqual(marksOf("post-xyz"));
    expect(paperTexture("post-abc", 0.9)).not.toBe(paperTexture("post-xyz", 0.9));
  });

  it("シミの位置は紙の中に収まる", () => {
    for (const id of ["a", "post-1234567890", "cmf0zzz"]) {
      for (const s of marksOf(id).stains) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(100);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("paperTexture", () => {
  it("おろしたては何も無い", () => {
    expect(paperTexture("post-abc", 0)).toBe("none");
  });

  it("進むほどシミが増える", () => {
    const count = (w: number) => (paperTexture("post-abc", w).match(/radial-gradient/g) ?? []).length;
    expect(count(0.1)).toBe(0);
    expect(count(0.5)).toBeGreaterThan(count(0.1));
    expect(count(1)).toBeGreaterThan(count(0.5));
  });

  it("角が折れるのは後半だけ", () => {
    expect(isFolded(0.2)).toBe(false);
    expect(isFolded(0.9)).toBe(true);
  });
});
