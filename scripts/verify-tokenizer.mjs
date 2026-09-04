// kuromoji で形態素解析が動くかだけを確かめる。DB もサーバも要らない。
//   node scripts/verify-tokenizer.mjs
import { tokenize } from "../lib/morph.ts";
import { rankTerms } from "../lib/similar.ts";

const SAMPLE = "推しの新曲が良かった";
const tokens = await tokenize(SAMPLE);
console.log("tokenize:", JSON.stringify(tokens, null, 0));
if (tokens.length === 0) {
  console.error("FAIL: kuromoji が呼べていない（terms は空になり、近い投稿の行は出ない）");
  process.exit(1);
}
const kinds = new Set(tokens.map((t) => t.kind));
if (!kinds.has("noun") || !kinds.has("emotion")) {
  console.error("FAIL: 名詞と形容詞（感情語）の両方が出ていない:", [...kinds].join(","));
  process.exit(1);
}
console.log("ok: 名詞と形容詞が取れる");
console.log("rankTerms:", rankTerms(tokens).join(" "));

const withTerms = await tokenize("すいせいの配信", { terms: ["すいせい"] });
console.log("tokenize(terms):", JSON.stringify(withTerms));
if (!withTerms.some((t) => t.word === "すいせい" && t.kind === "proper")) {
  console.error("FAIL: terms の語が固有名詞として拾えていない");
  process.exit(1);
}
console.log("ok: terms の語を固有名詞として拾える");
console.log("ALL OK");
