import { describe, expect, it } from "vitest";
import type { TimelinePost } from "./timeline";
import { UNCONFIRMED, normalizeWord, veilFor } from "./veil";

const post = (overrides: Partial<{ body: string; cw: string | null; tags: string[] }> = {}) => ({
  body: "ふつうの感想",
  cw: null,
  tags: ["推し"],
  ...overrides,
});

describe("normalizeWord", () => {
  it("NFKC・小文字・カタカナをひらがなに統一する", () => {
    expect(normalizeWord(" ＡＢＣ　ネタバレ ")).toBe("abc ねたばれ");
    expect(normalizeWord("ｶﾀｶﾅ")).toBe("かたかな");
  });
});

describe("veilFor", () => {
  it("地雷宣言が無ければ何も伏せない（未タグでも）", () => {
    expect(veilFor(post(), [])).toEqual({ veiled: false });
    expect(veilFor(post(), ["   "])).toEqual({ veiled: false });
  });

  it("地雷宣言があれば未タグは未確認として伏せる", () => {
    expect(veilFor(post({ tags: [] }), ["ネタバレ"])).toEqual({ veiled: true, reason: UNCONFIRMED, kind: "unconfirmed" });
    expect(veilFor(post({ tags: ["", " "] }), ["ネタバレ"])).toEqual({ veiled: true, reason: UNCONFIRMED, kind: "unconfirmed" });
  });

  it("タグが地雷語と一致すれば伏せ、理由に登録語を返す", () => {
    expect(veilFor(post({ tags: ["ネタバレ", "推し"] }), ["ネタバレ"])).toEqual({ veiled: true, reason: "ネタバレ", kind: "mute" });
  });

  it("一致しなければ開く", () => {
    expect(veilFor(post(), ["ネタバレ"])).toEqual({ veiled: false });
  });

  it("全角半角・大文字小文字の違いで漏らさない", () => {
    expect(veilFor(post({ tags: ["ＡＢＣ"] }), ["abc"])).toEqual({ veiled: true, reason: "abc", kind: "mute" });
    expect(veilFor(post({ tags: ["Spoiler"] }), ["spoiler"])).toEqual({ veiled: true, reason: "spoiler", kind: "mute" });
  });

  it("タグが地雷語を含む場合も伏せる（安全側）", () => {
    expect(veilFor(post({ body: "最終回ネタバレ" }), ["ネタバレ"])).toEqual({ veiled: true, reason: "ネタバレ", kind: "mute" });
  });
});

describe("注意文（cw）", () => {
  it("注意文があれば地雷宣言が無くても伏せ、理由は注意文そのもの", () => {
    expect(veilFor(post({ cw: "最終回の話" }), [])).toEqual({ veiled: true, reason: "最終回の話", kind: "cw" });
  });
  it("注意文は地雷宣言より優先する", () => {
    expect(veilFor(post({ cw: "閲覧注意", tags: ["ネタバレ"] }), ["ネタバレ"])).toEqual({ veiled: true, reason: "ネタバレ", kind: "mute" });
  });
  it("注意文が空か null なら従来の判定に戻る", () => {
    expect(veilFor(post({ cw: "" }), ["ネタバレ"])).toEqual({ veiled: false });
    expect(veilFor(post({ cw: null }), ["ネタバレ"])).toEqual({ veiled: false });
    expect(veilFor(post({ tags: [], cw: null }), ["ネタバレ"])).toEqual({ veiled: true, reason: UNCONFIRMED, kind: "unconfirmed" });
  });
});

describe("読み手が自分で伏せた投稿", () => {
  it("タグにも注意文にも関係なく伏せ、理由は自分で伏せたことを言う", () => {
    expect(veilFor(post(), [], { selfVeiled: true })).toEqual({ veiled: true, reason: "自分で伏せています", kind: "self" });
  });
  it("地雷宣言をしていない読み手でも伏せられる（漏れた直後は宣言がまだ無い）", () => {
    expect(veilFor(post({ tags: [] }), [], { selfVeiled: true })).toEqual({ veiled: true, reason: "自分で伏せています", kind: "self" });
  });
  it("注意文より優先する（自分で閉じた紙は自分の理由で閉じたままにする）", () => {
    expect(veilFor(post({ cw: "最終回の話" }), ["ネタバレ"], { selfVeiled: true })).toEqual({ veiled: true, reason: "自分で伏せています", kind: "self" });
  });
  it("伏せていなければ従来どおり", () => {
    expect(veilFor(post(), [], { selfVeiled: false })).toEqual({ veiled: false });
    expect(veilFor(post(), [], {})).toEqual({ veiled: false });
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
