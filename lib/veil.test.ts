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
    expect(veilFor([], ["ネタバレ"])).toEqual({ veiled: true, reason: UNCONFIRMED, kind: "unconfirmed" });
    expect(veilFor(["", " "], ["ネタバレ"])).toEqual({ veiled: true, reason: UNCONFIRMED, kind: "unconfirmed" });
  });

  it("タグが地雷語と一致すれば伏せ、理由に登録語を返す", () => {
    expect(veilFor(["ネタバレ", "推し"], ["ネタバレ"])).toEqual({ veiled: true, reason: "ネタバレ", kind: "mute" });
  });

  it("一致しなければ開く", () => {
    expect(veilFor(["推し"], ["ネタバレ"])).toEqual({ veiled: false });
  });

  it("全角半角・大文字小文字の違いで漏らさない", () => {
    expect(veilFor(["ＡＢＣ"], ["abc"])).toEqual({ veiled: true, reason: "abc", kind: "mute" });
    expect(veilFor(["Spoiler"], ["spoiler"])).toEqual({ veiled: true, reason: "spoiler", kind: "mute" });
  });

  it("タグが地雷語を含む場合も伏せる（安全側）", () => {
    expect(veilFor(["最終回ネタバレ"], ["ネタバレ"])).toEqual({ veiled: true, reason: "ネタバレ", kind: "mute" });
  });
});

describe("注意文（cw）", () => {
  it("注意文があれば地雷宣言が無くても伏せ、理由は注意文そのもの", () => {
    expect(veilFor(["推し"], [], "最終回の話")).toEqual({ veiled: true, reason: "最終回の話", kind: "cw" });
  });
  it("注意文は地雷宣言より優先する", () => {
    expect(veilFor(["ネタバレ"], ["ネタバレ"], "閲覧注意")).toEqual({ veiled: true, reason: "閲覧注意", kind: "cw" });
  });
  it("注意文が空か null なら従来の判定に戻る", () => {
    expect(veilFor(["推し"], ["ネタバレ"], "")).toEqual({ veiled: false });
    expect(veilFor(["推し"], ["ネタバレ"], null)).toEqual({ veiled: false });
    expect(veilFor([], ["ネタバレ"], null)).toEqual({ veiled: true, reason: UNCONFIRMED, kind: "unconfirmed" });
  });
});

describe("読み手が自分で伏せた投稿", () => {
  it("タグにも注意文にも関係なく伏せ、理由は自分で伏せたことを言う", () => {
    expect(veilFor(["推し"], [], null, { selfVeiled: true })).toEqual({ veiled: true, reason: "自分で伏せています", kind: "self" });
  });
  it("地雷宣言をしていない読み手でも伏せられる（漏れた直後は宣言がまだ無い）", () => {
    expect(veilFor([], [], null, { selfVeiled: true })).toEqual({ veiled: true, reason: "自分で伏せています", kind: "self" });
  });
  it("注意文より優先する（自分で閉じた紙は自分の理由で閉じたままにする）", () => {
    expect(veilFor(["推し"], ["ネタバレ"], "最終回の話", { selfVeiled: true })).toEqual({ veiled: true, reason: "自分で伏せています", kind: "self" });
  });
  it("伏せていなければ従来どおり", () => {
    expect(veilFor(["推し"], [], null, { selfVeiled: false })).toEqual({ veiled: false });
    expect(veilFor(["推し"], [], null, {})).toEqual({ veiled: false });
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
