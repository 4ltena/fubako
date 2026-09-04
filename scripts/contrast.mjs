// 面どうし・字と面の対比を数える。app/globals.css の値を変えたらここも直して走らせる。
//   node scripts/contrast.mjs
// 目安: 面は 1.2 以上（重なる面は 1.25〜1.3）、本文と小さい字は 4.5 以上、
// プレースホルダは 3 以上。数字は WCAG のコントラスト比。
const hex = (h) => [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255);
const lin = (c) => c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4;
const L = (h) => { const [r,g,b] = hex(h).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
const ratio = (a,b) => { const l1=L(a), l2=L(b); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };

// 案: 地を一段落とし、伏せた紙は沈め、反応と緑は実際に見える段へ動かす
const light = { paper:"#e4d7c0", screen:"#ece0cb", card:"#fdf9f3", veil:"#d6c9b3", line:"#cfc4b1", slot:"#bcae95", slotRule:"#eee7dc",
  ink:"#201e1d", inkSoft:"#544c42", inkFaint:"#584f43", inkPale:"#948a78",
  accent:"#8c491a", accentDeep:"#643312", accentPale:"#ffd0b3",
  sage:"#c6d6a9", sageFill:"#a8ba8a", sageInk:"#3d472b", sageDeep:"#2b3320" };
const dark = { paper:"#1f1913", screen:"#2a231d", card:"#3a3128", veil:"#161009", line:"#4f483d", slot:"#332b22", slotRule:"#191309",
  ink:"#f5ead8", inkSoft:"#cdc3b2", inkFaint:"#a89d8b", inkPale:"#857b6c",
  accent:"#f6a06b", accentDeep:"#ffc6a5", accentPale:"#6b3a1a",
  sage:"#3d472b", sageFill:"#56633f", sageInk:"#ccdbb2", sageDeep:"#e1eecc" };

const pairs = [
  ["面: 紙 / 地", "card", "screen", 1.2],
  ["面: 伏せた紙 / 地", "veil", "screen", 1.2],
  ["面: 伏せた紙 / 紙", "veil", "card", 1.3],
  ["面: へこみ / 伏せた紙", "slot", "veil", 1.25],
  ["面: へこみの線 / へこみ", "slotRule", "slot", 1.3],
  ["面: たより(緑) / 地", "sage", "screen", 1.15],
  ["面: 罫 / 紙", "line", "card", 1.3],
  ["字: 本文 / 紙", "ink", "card", 4.5],
  ["字: 弱い字 / 紙", "inkSoft", "card", 4.5],
  ["字: 薄い字 / 紙", "inkFaint", "card", 4.5],
  ["字: プレースホルダ / 紙", "inkPale", "card", 3.0],
  ["字: 弱い字 / 伏せた紙", "inkSoft", "veil", 4.5],
  ["字: 薄い字 / 伏せた紙", "inkFaint", "veil", 4.5],
  ["字: 本文 / 地", "ink", "screen", 4.5],
  ["字: 弱い字 / 地", "inkSoft", "screen", 4.5],
  ["ボタン: 紙色の字 / 主ボタン", "card", "accent", 4.5],
  ["ボタン: 届いた(字/地)", "accent", "accentPale", 4.5],
  ["ボタン: ひらく(字/地)", "card", "inkFaint", 4.5],
  ["タグ: 字 / 緑", "sageInk", "sage", 4.5],
  ["たより: 字 / 緑", "sageDeep", "sage", 4.5],
  ["読みこむ: 字 / 濃い緑", "sageDeep", "sageFill", 4.5],
  ["面: 濃い緑 / 緑", "sageFill", "sage", 1.3],
  ["リンク: 主色 / 紙", "accent", "card", 4.5],
  ["面: 届いた地 / 紙", "accentPale", "card", 1.3],
];

for (const [theme, t] of [["ライト", light], ["ダーク", dark]]) {
  console.log("\n===== " + theme + " =====");
  for (const [name, a, b, min] of pairs) {
    const r = ratio(t[a], t[b]);
    const ok = r >= min;
    console.log(`${ok ? "  " : "NG"} ${name.padEnd(28)} ${r.toFixed(2).padStart(6)}  (目安 ${min})`);
  }
}
