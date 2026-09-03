/**
 * 形態素解析。MeCab（https://taku910.github.io/mecab/）だけを使う。
 *
 * 呼び出しは子プロセス（`mecab` コマンド）。バインディング（mecab-async 等）は
 * ネイティブビルドが Node のバージョンに追随せず、`npm ci` が壊れる事故のほうが
 * 高くつくので採らない。子プロセスなら Docker イメージに `mecab` があれば動く。
 *
 * 出力フォーマットは mecabrc に依存しないよう -F / -U / -E で固定する
 * （-Ochasen は mecabrc 側の定義が要るため使わない）。パースは morph.test.ts で守る。
 *
 * MeCab が無い環境（ローカル開発など）では例外を投げず空配列を返す。
 * 呼び出し側は「近い投稿の行が出ないだけ」で投稿は通す。
 *
 * サーバ側専用。辞書もバイナリもクライアントには送らない。
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** 語の種類。固有名詞（キャラ名・作品名）を最も重く扱う。 */
export type Kind = "proper" | "noun" | "emotion";
export type Token = { word: string; kind: Kind };

export type TokenizeOptions = {
  /** `mecab` の実行ファイル。既定は MECAB_BIN か "mecab"。 */
  bin?: string;
  /** userDictFrom が作ったユーザー辞書のパス。 */
  userDict?: string | null;
  /** これを超えたら諦めて空配列を返す。 */
  timeoutMs?: number;
};

export const DEFAULT_TIMEOUT_MS = 5000;
/** ipadic-utf8 の辞書。Debian 系の既定位置。環境で変えられる。 */
export const DICDIR = process.env.MECAB_DICDIR ?? "/var/lib/mecab/dic/ipadic-utf8";
/** ユーザー辞書に入れる語のコスト。小さいほど1語として切り出されやすい。暫定値。 */
export const USER_DICT_COST = 1000;
/** ユーザー辞書に入れるタグ数の上限。 */
export const USER_DICT_MAX_WORDS = 500;

/** ipadic の素性: 品詞,細分類1,細分類2,細分類3,活用型,活用形,原形,読み,発音 */
const FORMAT_ARGS = [
  "-F",
  "%m\t%f[0]\t%f[1]\t%f[6]\n",
  // 未知語は原形（%f[6]）が * になるので表層形をそのまま原形として使う
  "-U",
  "%m\t%f[0]\t%f[1]\t%m\n",
  "-E",
  "EOS\n",
];

/** 感情語として拾っても意味の薄い動詞。 */
const WEAK_VERBS = new Set(["する", "居る", "有る", "成る", "遣る", "為る", "いる", "ある", "なる", "やる", "できる", "ゆく"]);

let warned = false;
function warnUnavailable(reason: string): void {
  if (warned) return;
  warned = true;
  console.warn(JSON.stringify({ event: "mecab_unavailable", reason }));
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

/** MeCab の出力（FORMAT_ARGS で固定した4列）を語に直す。 */
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

function runMecab(input: string, args: string[], bin: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let child;
    try {
      child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      warnUnavailable(String(e));
      return finish(null);
    }
    const chunks: Buffer[] = [];
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      warnUnavailable("timeout");
      finish(null);
    }, timeoutMs);
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    // 起動に失敗すると stdin.end() が EPIPE を投げる。プロセスごと落とさない。
    child.stdin.on("error", () => {});
    child.on("error", (e) => {
      clearTimeout(timer);
      warnUnavailable(String(e));
      finish(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        warnUnavailable(stderr.trim() || `exit ${code}`);
        return finish(null);
      }
      finish(Buffer.concat(chunks).toString("utf8"));
    });
    // 改行は文の区切りにしない（1投稿を1続きの文として渡す）
    child.stdin.end(`${input.replace(/\r?\n/g, "　")}\n`, "utf8");
  });
}

/** 本文を語に分ける。MeCab が無ければ空配列（例外は投げない）。 */
export async function tokenize(text: string, options: TokenizeOptions = {}): Promise<Token[]> {
  const body = text.trim();
  if (body.length === 0) return [];
  const args = [...FORMAT_ARGS];
  if (options.userDict) args.push("-u", options.userDict);
  const out = await runMecab(body, args, options.bin ?? process.env.MECAB_BIN ?? "mecab", options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return out === null ? [] : parseMecab(out);
}

/**
 * サークルのタグからユーザー辞書の CSV を作る。
 * ipadic の CSV は 表層形,左文脈ID,右文脈ID,コスト,品詞,細分類1..3,活用型,活用形,原形,読み,発音。
 * 文脈 ID を -1 にすると mecab-dict-index が推定する。
 */
export function userDictCsv(tags: readonly string[]): string {
  const words = [...new Set(tags.map((t) => t.replace(/[,"\r\n\t]/g, "").trim()).filter((t) => t.length > 0 && t.length <= 30))].slice(0, USER_DICT_MAX_WORDS);
  return words.map((w) => `${w},-1,-1,${USER_DICT_COST},名詞,固有名詞,一般,*,*,*,${w},*,*`).join("\n");
}

/**
 * タグを固有名詞として登録したユーザー辞書を作り、そのパスを返す。
 * mecab-dict-index が無ければ null（ユーザー辞書なしで解析する）。
 * 同じタグ集合なら作り直さない。
 */
export async function userDictFrom(tags: readonly string[], options: { bin?: string; dicdir?: string } = {}): Promise<string | null> {
  const csv = userDictCsv(tags);
  if (csv.length === 0) return null;
  const hash = createHash("sha1").update(csv).digest("hex").slice(0, 16);
  const out = join(tmpdir(), `fubako-userdic-${hash}.dic`);
  if (existsSync(out)) return out;
  const dir = await mkdtemp(join(tmpdir(), "fubako-dict-"));
  const csvPath = join(dir, "user.csv");
  await writeFile(csvPath, `${csv}\n`, "utf8");
  const args = ["-d", options.dicdir ?? DICDIR, "-u", out, "-f", "utf-8", "-t", "utf-8", csvPath];
  const ok = await runMecab("", args, options.bin ?? process.env.MECAB_DICT_INDEX ?? "mecab-dict-index", DEFAULT_TIMEOUT_MS);
  return ok === null ? null : out;
}
