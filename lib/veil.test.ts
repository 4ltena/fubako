import { describe, expect, it } from "vitest";
import type { TimelinePost } from "./timeline";
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

describe("伏せた投稿が持たないもの", () => {
  it("伏せた投稿は form を持たない（形から本文が推測できるため）", () => {
    // TimelinePost の veiled: true 側に form が無いことを型で固定する。
    const veiled = { veiled: true, reason: "ネタバレ" } as Extract<TimelinePost, { veiled: true }>;
    expect("form" in veiled).toBe(false);
    // @ts-expect-error 伏せた投稿に form は無い
    expect(veiled.form).toBeUndefined();
  });
});
