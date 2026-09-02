import { describe, expect, it } from "vitest";
import { UNCONFIRMED, veilFor } from "./veil";

describe("veilFor", () => {
  it("地雷宣言が無ければ何も伏せない（未タグでも）", () => {
    expect(veilFor([], [])).toEqual({ veiled: false });
    expect(veilFor(["ネタバレ"], [])).toEqual({ veiled: false });
    expect(veilFor([], ["   "])).toEqual({ veiled: false });
  });

  it("地雷宣言があれば未タグは未確認として伏せる", () => {
    expect(veilFor([], ["ネタバレ"])).toEqual({ veiled: true, reason: UNCONFIRMED });
    expect(veilFor(["", " "], ["ネタバレ"])).toEqual({ veiled: true, reason: UNCONFIRMED });
  });

  it("タグが地雷語と一致すれば伏せ、理由に登録語を返す", () => {
    expect(veilFor(["ネタバレ", "推し"], ["ネタバレ"])).toEqual({ veiled: true, reason: "ネタバレ" });
  });

  it("一致しなければ開く", () => {
    expect(veilFor(["推し"], ["ネタバレ"])).toEqual({ veiled: false });
  });

  it("全角半角・大文字小文字の違いで漏らさない", () => {
    expect(veilFor(["ＡＢＣ"], ["abc"])).toEqual({ veiled: true, reason: "abc" });
    expect(veilFor(["Spoiler"], ["spoiler"])).toEqual({ veiled: true, reason: "spoiler" });
  });

  it("タグが地雷語を含む場合も伏せる（安全側）", () => {
    expect(veilFor(["最終回ネタバレ"], ["ネタバレ"])).toEqual({ veiled: true, reason: "ネタバレ" });
  });
});
