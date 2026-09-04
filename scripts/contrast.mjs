// 面どうし・字と面の対比を数える。app/globals.css の値を変えたらここも直して走らせる。
//   node scripts/contrast.mjs
// 目安: 本文と小さい字は 4.5 以上、プレースホルダは 3 以上。数字は WCAG のコントラスト比。
const hex = (h) => [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255);
const lin = (c) => c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4;
const L = (h) => { const [r,g,b] = hex(h).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
const ratio = (a,b) => { const l1=L(a), l2=L(b); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05); };

// 「白い箱」トークン（app/globals.css の @theme と一致させる）
const t = {
  paper: "#fbfbfa",
  paper2: "#f3f3f1",
  line: "#e6e6e2",
  line2: "#d4d4cf",
  ink: "#1a1a1a",
  inkDim: "#6b6b66",
  inkFaint: "#8a8a84",
  veil: "#ececea",
  veilInk: "#4a4a46",
};

const pairs = [
  ["字: 本文 / 地", "ink", "paper", 4.5],
  ["字: 補助の字 / 地", "inkDim", "paper", 4.5],
  ["字: 薄い字(プレースホルダ) / 地", "inkFaint", "paper", 3.0],
  ["字: 伏せ字の面の字 / 伏せ字の面", "veilInk", "veil", 4.5],
  ["面: タブの帯 / 地", "paper2", "paper", 1.05],
  ["ボタン: 地色の字 / 墨のボタン", "paper", "ink", 4.5],
];

console.log("\n===== 白い箱 =====");
for (const [name, a, b, min] of pairs) {
  const r = ratio(t[a], t[b]);
  const ok = r >= min;
  console.log(`${ok ? "  " : "NG"} ${name.padEnd(28)} ${r.toFixed(2).padStart(6)}  (目安 ${min})`);
}
