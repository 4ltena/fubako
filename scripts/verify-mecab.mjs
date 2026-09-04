// コンテナの中で形態素解析が動くかだけを確かめる。DB もサーバも要らない。
//   docker run --rm fubako node scripts/verify-mecab.mjs
import { tokenize, userDictFrom } from "../lib/morph.ts";
import { rankTerms } from "../lib/similar.ts";

const SAMPLE = "推しの新曲が良かった";
const tokens = await tokenize(SAMPLE);
console.log("tokenize:", JSON.stringify(tokens, null, 0));
if (tokens.length === 0) {
  console.error("FAIL: MeCab が無いか呼べていない（terms は空になり、近い投稿の行は出ない）");
  process.exit(1);
}
const kinds = new Set(tokens.map((t) => t.kind));
if (!kinds.has("noun") || !kinds.has("emotion")) {
  console.error("FAIL: 名詞と形容詞（感情語）の両方が出ていない:", [...kinds].join(","));
  process.exit(1);
}
console.log("ok: 名詞と形容詞が取れる");
console.log("rankTerms:", rankTerms(tokens).join(" "));

const dict = await userDictFrom(["ホロライブ", "すいせい"]);
console.log("userDict:", dict ?? "（作れなかった。ユーザー辞書なしで動く）");
if (dict) {
  const withDict = await tokenize("すいせいの配信", { userDict: dict });
  console.log("tokenize(userDict):", JSON.stringify(withDict));
  if (!withDict.some((t) => t.word === "すいせい" && t.kind === "proper")) {
    console.error("FAIL: ユーザー辞書の語が固有名詞として拾えていない");
    process.exit(1);
  }
  console.log("ok: タグをユーザー辞書として拾える");
}
console.log("ALL OK");
