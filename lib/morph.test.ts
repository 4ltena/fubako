import { describe, expect, it } from "vitest";
import { parseMecab, tokenize, userDictCsv, USER_DICT_COST } from "./morph.ts";

// MeCab に FORMAT_ARGS の書式（表層形・品詞・細分類1・原形 のタブ区切り4列）を
// 渡したときの出力。この形が変わるとパースが壊れるので、ここで形ごと固定する。
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

describe("MeCab が無い環境", () => {
  it("tokenize は例外を投げず空配列を返す", async () => {
    await expect(tokenize("推しの新曲が良かった", { bin: "fubako-no-such-mecab" })).resolves.toEqual([]);
  });

  it("空文字はそもそも解析しない", async () => {
    await expect(tokenize("   ", { bin: "fubako-no-such-mecab" })).resolves.toEqual([]);
  });
});

describe("userDictCsv", () => {
  it("タグを固有名詞として1行ずつ書き出す", () => {
    expect(userDictCsv(["ネタバレ"])).toBe(`ネタバレ,-1,-1,${USER_DICT_COST},名詞,固有名詞,一般,*,*,*,ネタバレ,*,*`);
  });

  it("重複と空白を落とし、CSV を壊す文字を取り除く", () => {
    const csv = userDictCsv(["推し", "推し", "  ", "あ,い"]);
    expect(csv.split("\n").length).toBe(2);
    expect(csv).toContain("あい,-1,-1,");
  });

  it("タグが無ければ空", () => {
    expect(userDictCsv([])).toBe("");
  });
});
