import { describe, expect, it } from "vitest";
import { parseMecab, tokenize } from "./morph.ts";

// kuromoji のトークンを整形した4列（表層形・品詞・細分類1・原形）のタブ区切り出力。
// この形が変わるとパースが壊れるので、ここで形ごと固定する。
const SAMPLE = "推し\t名詞\t一般\t推し\nの\t助詞\t連体化\tの\n新曲\t名詞\t一般\t新曲\nが\t助詞\t格助詞\tが\n良かっ\t形容詞\t自立\t良い\nた\t助動詞\t*\tた\n。\t記号\t句点\t。\nEOS\n";
const NOISE = "3\t名詞\t数\t*\n回\t名詞\t接尾\t回\nそれ\t名詞\t代名詞\tそれ\nし\t動詞\t自立\tする\nホロライブ\t名詞\t固有名詞\t*\nEOS\n";

describe("parseMecab", () => {
  it("名詞と形容詞を原形で残し、助詞・助動詞・記号は落とす", () => {
    expect(parseMecab(SAMPLE)).toEqual([
      { word: "推し", kind: "noun" },
      { word: "新曲", kind: "noun" },
      { word: "良い", kind: "emotion" },
    ]);
  });

  it("数字・接尾・代名詞・意味の薄い動詞を落とし、未知語の固有名詞は表層形で拾う", () => {
    expect(parseMecab(NOISE)).toEqual([{ word: "ホロライブ", kind: "proper" }]);
  });

  it("空の出力でも落ちない", () => {
    expect(parseMecab("")).toEqual([]);
    expect(parseMecab("EOS\n")).toEqual([]);
  });
});

describe("空文字", () => {
  it("空文字はそもそも解析しない", async () => {
    await expect(tokenize("   ")).resolves.toEqual([]);
  });
});

describe("kuromoji で実際に解析する", () => {
  // kuromoji の ipadic では「推し」は動詞「推す」の連用形として解析される
  // （MeCab と違い名詞化した語として辞書に無い）。原形で拾えることを確かめる。
  it("「推しの新曲が良かった」から 推す・新曲・良い が出る", async () => {
    const tokens = await tokenize("推しの新曲が良かった");
    const words = tokens.map((t) => t.word);
    expect(words).toContain("推す");
    expect(words).toContain("新曲");
    expect(words).toContain("良い");
  });

  it("terms に入っている語が本文に含まれていれば proper として先頭に出る", async () => {
    const tokens = await tokenize("すいせいの配信", { terms: ["すいせい"] });
    expect(tokens[0]).toEqual({ word: "すいせい", kind: "proper" });
  });
});
