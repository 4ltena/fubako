import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(([, name, value]) => [name, value]));
const required = ["paper", "paper-2", "line", "line-2", "ink", "ink-dim", "ink-faint", "veil", "veil-ink"];
for (const key of required) if (!tokens[key]) throw new Error(`globals.css に --color-${key} がありません`);
const hex = (value) => [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16) / 255);
const linear = (value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const luminance = (value) => { const [r, g, b] = hex(value).map(linear); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + .05) / (low + .05); };
const pairs = [["本文 / 地", "ink", "paper", 4.5], ["補助文字 / 地", "ink-dim", "paper", 4.5], ["薄い文字 / 地", "ink-faint", "paper", 4.5], ["伏せ文字 / 伏せ面", "veil-ink", "veil", 4.5], ["紙色の文字 / 墨", "paper", "ink", 4.5], ["帯 / 地", "paper-2", "paper", 1.05]];
let failed = false;
for (const [name, foreground, background, minimum] of pairs) { const value = ratio(tokens[foreground], tokens[background]); const ok = value >= minimum; console.log(`${ok ? "OK" : "NG"} ${name}: ${value.toFixed(2)} (最低 ${minimum})`); failed ||= !ok; }
// 便箋は0〜30日で #fffdf5 / #1a1a1a からこの終端色へ連続的に移る。
// 終端を検査すれば、本文を透明化せず最低比を保つ設計を守れる。
const letterPaper = "#e8d9ad";
const letterInk = "#685c45";
const letterRatio = ratio(letterInk, letterPaper);
const letterOk = letterRatio >= 4.5;
console.log(`${letterOk ? "OK" : "NG"} 便箋本文 / 30日後の紙: ${letterRatio.toFixed(2)} (最低 4.5)`);
failed ||= !letterOk;
if (failed) process.exitCode = 1;
