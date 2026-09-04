/**
 * 形態素解析。kuromoji.js（純粋 JS、ipadic 同梱）を使う。
 *
 * MeCab の子プロセス呼び出しは廃止した。Vercel の関数はネイティブバイナリを
 * 常駐させられないため、Node だけで完結する kuromoji に置き換えている。
 * ユーザー辞書は持たない。サークルのタグの語は本文との文字列一致で拾う
 * （`TokenizeOptions.terms`）。
 *
 * トークナイザは module scope で1度だけ構築し、以後は使い回す（辞書の読み込みは重い）。
 * 構築に失敗した場合や解析中に例外が起きた場合は、今までどおり例外を投げず
 * 空配列を返し、`console.warn` に `{ event: "tokenizer_unavailable", reason }` を出す。
 *
 * kuromoji のトークン（surface_form/pos/pos_detail_1/basic_form）は、既存の
 * 4列タブ形式（表層形・品詞・細分類1・原形。原形が `*` なら表層形）に整形して
 * parseMecab に通す。分類ロジックを二重に持たないため。
 *
 * サーバ側専用。辞書もモデルもクライアントには送らない。
 */
import kuromoji from "kuromoji";
import { join } from "node:path";

/** 語の種類。固有名詞（キャラ名・作品名）を最も重く扱う。 */
export type Kind = "proper" | "noun" | "emotion";
export type Token = { word: string; kind: Kind };

export type TokenizeOptions = {
  /** サークルのタグなど。本文に文字列として含まれていれば proper として先頭に足す。 */
  terms?: string[];
};

/** ipadic 辞書のパス。kuromoji 同梱のもの。 */
const DIC_PATH = join("node_modules", "kuromoji", "dict");

/** 感情語として拾っても意味の薄い動詞。 */
const WEAK_VERBS = new Set(["する", "居る", "有る", "成る", "遣る", "為る", "いる", "ある", "なる", "やる", "できる", "ゆく"]);

let warned = false;
function warnUnavailable(reason: string): void {
  if (warned) return;
  warned = true;
  console.warn(JSON.stringify({ event: "tokenizer_unavailable", reason }));
}

function classify(pos: string, sub1: string): Kind | null {
  if (pos === "名詞") {
    if (sub1 === "固有名詞") return "proper";
    if (sub1 === "一般" || sub1 === "サ変接続") return "noun";
    if (sub1 === "形容動詞語幹") return "emotion";
    return null; // 代名詞・非自立・接尾・数・副詞可能は落とす
  }
  if (pos === "形容詞" && sub1 === "自立") return "emotion";
  if (pos === "動詞" && sub1 === "自立") return "emotion";
  return null; // 助詞・助動詞・記号・接続詞・フィラーなどは落とす
}

/** 数字だけ・記号だけ・ひらがな1文字は語として扱わない。 */
function isNoise(word: string): boolean {
  if (word.length === 0 || word === "*") return true;
  if (/^[0-9０-９.,、。・･]+$/.test(word)) return true;
  if (/^[ぁ-んー]$/.test(word)) return true;
  return false;
}

/** 4列タブ形式（表層形・品詞・細分類1・原形）の出力を語に直す。 */
export function parseMecab(out: string): Token[] {
  const tokens: Token[] = [];
  for (const line of out.split("\n")) {
    if (line === "" || line === "EOS") continue;
    const [surface, pos, sub1, base] = line.split("\t");
    if (pos === undefined || sub1 === undefined) continue;
    const kind = classify(pos, sub1);
    if (kind === null) continue;
    const word = base && base !== "*" ? base : (surface ?? "");
    if (isNoise(word)) continue;
    if (kind === "emotion" && WEAK_VERBS.has(word)) continue;
    tokens.push({ word, kind });
  }
  return tokens;
}

type KuromojiTokenizer = { tokenize(text: string): kuromoji.IpadicFeatures[] };

let tokenizerPromise: Promise<KuromojiTokenizer | null> | null = null;

function buildTokenizer(): Promise<KuromojiTokenizer | null> {
  return new Promise((resolve) => {
    kuromoji.builder({ dicPath: DIC_PATH }).build((err, tokenizer) => {
      if (err) {
        warnUnavailable(String(err));
        resolve(null);
        return;
      }
      resolve(tokenizer);
    });
  });
}

function getTokenizer(): Promise<KuromojiTokenizer | null> {
  if (!tokenizerPromise) tokenizerPromise = buildTokenizer();
  return tokenizerPromise;
}

/** kuromoji のトークンを既存の4列タブ形式に整形する。 */
function formatTokens(tokens: kuromoji.IpadicFeatures[]): string {
  return (
    tokens.map((t) => `${t.surface_form}\t${t.pos}\t${t.pos_detail_1}\t${t.basic_form}\n`).join("") + "EOS\n"
  );
}

/** タグの語が本文に文字列として含まれていれば proper として先頭に足す（重複除く）。 */
function withTerms(tokens: Token[], body: string, terms: string[] | undefined): Token[] {
  if (!terms || terms.length === 0) return tokens;
  const found = terms.filter((t) => t.length > 0 && body.includes(t));
  if (found.length === 0) return tokens;
  const words = new Set(tokens.map((t) => t.word));
  const extra = [...new Set(found)].filter((w) => !words.has(w)).map((word): Token => ({ word, kind: "proper" }));
  return [...extra, ...tokens];
}

/** 本文を語に分ける。kuromoji が使えなければ空配列（例外は投げない）。 */
export async function tokenize(text: string, options: TokenizeOptions = {}): Promise<Token[]> {
  const body = text.trim();
  if (body.length === 0) return [];
  const tokenizer = await getTokenizer();
  if (tokenizer === null) return [];
  try {
    const tokens = parseMecab(formatTokens(tokenizer.tokenize(body)));
    return withTerms(tokens, body, options.terms);
  } catch (e) {
    warnUnavailable(String(e));
    return [];
  }
}
