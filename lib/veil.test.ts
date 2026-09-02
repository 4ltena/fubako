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

describe("注意文（cw）", () => {
  it("注意文があれば地雷宣言が無くても伏せ、理由は注意文そのもの", () => {
    expect(veilFor(["推し"], [], "最終回の話")).toEqual({ veiled: true, reason: "最終回の話" });
  });
  it("注意文は地雷宣言より優先する", () => {
    expect(veilFor(["ネタバレ"], ["ネタバレ"], "閲覧注意")).toEqual({ veiled: true, reason: "閲覧注意" });
  });
  it("注意文が空か null なら従来の判定に戻る", () => {
    expect(veilFor(["推し"], ["ネタバレ"], "")).toEqual({ veiled: false });
    expect(veilFor(["推し"], ["ネタバレ"], null)).toEqual({ veiled: false });
    expect(veilFor([], ["ネタバレ"], null)).toEqual({ veiled: true, reason: UNCONFIRMED });
  });
});
