import { describe, expect, it } from "vitest";
import type { Token } from "./morph.ts";
import { COMMON_MATCH_MIN, extractTerms, HEAVY_HEAD, isSimilar, pickSimilar, rankTerms } from "./similar.ts";

const proper = (w: string): Token => ({ word: w, kind: "proper" });
const noun = (w: string): Token => ({ word: w, kind: "noun" });
const emotion = (w: string): Token => ({ word: w, kind: "emotion" });

describe("rankTerms", () => {
  it("固有名詞・一般名詞・感情語の順に並べる", () => {
    expect(rankTerms([emotion("嬉しい"), noun("配信"), proper("ホロライブ")])).toEqual(["ホロライブ", "配信", "嬉しい"]);
  });

  it("前後の投稿にも出た固有名詞を先頭に上げる", () => {
    const tokens = [proper("すいせい"), proper("ホロライブ"), noun("配信")];
    const recent = [[proper("ホロライブ"), noun("グッズ")], [proper("ホロライブ")]];
    // 直近でも語られている「ホロライブ」が、先に出てきた「すいせい」より前に来る
    expect(rankTerms(tokens, recent)[0]).toBe("ホロライブ");
    expect(rankTerms(tokens, recent).slice(0, 2)).toEqual(["ホロライブ", "すいせい"]);
  });

  it("同じ語は1つにまとめる", () => {
    expect(rankTerms([noun("配信"), noun("配信"), noun("感想")])).toEqual(["配信", "感想"]);
  });

  it("語が無ければ空", () => {
    expect(rankTerms([])).toEqual([]);
  });
});

describe("isSimilar", () => {
  it("重い語（固有名詞）が1つ共通なら近い", () => {
    const a = rankTerms([proper("ホロライブ"), noun("配信")]);
    const b = rankTerms([proper("ホロライブ"), noun("グッズ"), emotion("嬉しい")]);
    expect(isSimilar(a, b)).toBe(true);
  });

  it("一般名詞が2語共通なら近い", () => {
    const a = ["固有A", "固有B", "固有C", "配信", "感想"];
    const b = ["固有D", "固有E", "固有F", "配信", "感想"];
    expect(a.slice(0, HEAVY_HEAD).some((w) => b.slice(0, HEAVY_HEAD).includes(w))).toBe(false);
    expect(isSimilar(a, b)).toBe(true);
  });

  it("重くない語が1つだけ共通なら近くない", () => {
    const a = ["固有A", "固有B", "固有C", "配信"];
    const b = ["固有D", "固有E", "固有F", "配信"];
    expect(COMMON_MATCH_MIN).toBe(2);
    expect(isSimilar(a, b)).toBe(false);
  });

  it("語が無ければ近くない", () => {
    expect(isSimilar([], ["配信", "感想"])).toBe(false);
    expect(isSimilar(["配信", "感想"], [])).toBe(false);
  });
});

describe("pickSimilar", () => {
  const target = { id: "p1", authorId: "me", terms: ["ホロライブ", "配信"], veiled: false };
  const other = { id: "p2", authorId: "you", terms: ["ホロライブ", "グッズ"], veiled: false };

  it("近い投稿を1件だけ返す", () => {
    expect(pickSimilar(target, [other])).toEqual({ postId: "p2" });
  });

  it("複数あっても最新の1件だけ返す（新しい順に渡す）", () => {
    const older = { id: "p0", authorId: "you", terms: ["ホロライブ"], veiled: false };
    expect(pickSimilar(target, [other, older])).toEqual({ postId: "p2" });
  });

  it("同じ書き手の投稿は選ばない", () => {
    const mine = { id: "p3", authorId: "me", terms: ["ホロライブ", "配信"], veiled: false };
    expect(pickSimilar(target, [mine])).toBeNull();
    expect(pickSimilar(target, [target])).toBeNull();
  });

  it("読み手にとって伏せられる投稿へは案内しない", () => {
    expect(pickSimilar(target, [{ ...other, veiled: true }])).toBeNull();
    // 伏せられていない同等の投稿があればそちらを返す
    expect(pickSimilar(target, [{ ...other, veiled: true }, { ...other, id: "p9" }])).toEqual({ postId: "p9" });
  });

  it("近い投稿が無ければ null", () => {
    expect(pickSimilar(target, [{ id: "p4", authorId: "you", terms: ["料理", "献立"], veiled: false }])).toBeNull();
  });
});

describe("extractTerms", () => {
  it("空文字では空配列を返し、例外を投げない（投稿は通る）", async () => {
    await expect(extractTerms("", ["前の投稿"])).resolves.toEqual([]);
  });
});
