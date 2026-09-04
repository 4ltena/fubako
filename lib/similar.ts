/**
 * 「近いことを書いた人がいます」の判定。
 *
 * 出すのは投稿1件への案内だけ。人の一覧も、似ている度合いも、推定した話題も出さない。
 * 語（terms）はサーバから外に出さない。
 *
 * 閾値はすべて暫定。根拠は無く、使ってみて動かす前提でここに集めてある。
 */
import { tokenize, type Token, type TokenizeOptions } from "./morph.ts";

/** 保存する語の上限。 */
export const MAX_TERMS = 20;
/** terms の先頭何語を「重い語」とみなすか。extractTerms は固有名詞を先頭に置く。 */
export const HEAVY_HEAD = 3;
/** 重い語で一致しないときに必要な共通語数。 */
export const COMMON_MATCH_MIN = 2;
/** 「その書き手が今語っている対象」を測るために遡る、同じサークルでの直近の投稿数。 */
export const RECENT_BODIES = 5;

/** 語の重み。数値は保存せず、並び順にだけ落とす。 */
const WEIGHT: Record<Token["kind"], number> = { proper: 100, noun: 50, emotion: 20 };
/** 直近の投稿にも出た固有名詞への加点。 */
const REPEAT_BONUS = 40;
/** 同じ投稿の中で繰り返された分の加点。 */
const FREQUENCY_BONUS = 5;

/**
 * 語を重い順に並べる。数値は返さない（順番だけが重み）。
 *
 * 同じ書き手が直近でも書いていた固有名詞を上に上げる。
 * 「その書き手が今語っている対象」を先頭に置くための重み付け。
 */
export function rankTerms(tokens: readonly Token[], recentTokens: readonly (readonly Token[])[] = []): string[] {
  const repeated = new Set<string>();
  for (const recent of recentTokens) {
    for (const t of recent) {
      if (t.kind === "proper") repeated.add(t.word);
    }
  }
  const scored = new Map<string, { score: number; order: number }>();
  tokens.forEach((t, i) => {
    const found = scored.get(t.word);
    if (found) {
      found.score += FREQUENCY_BONUS;
      return;
    }
    const bonus = t.kind === "proper" && repeated.has(t.word) ? REPEAT_BONUS : 0;
    scored.set(t.word, { score: WEIGHT[t.kind] + bonus, order: i });
  });
  return [...scored.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[1].order - b[1].order)
    .slice(0, MAX_TERMS)
    .map(([word]) => word);
}

/**
 * 投稿から語を取り出す。作成時に1回だけ呼ぶ。
 * MeCab が無ければ空配列（投稿は通り、近い投稿の行が出ないだけ）。
 */
export async function extractTerms(body: string, authorRecentBodies: readonly string[] = [], options: TokenizeOptions = {}): Promise<string[]> {
  const tokens = await tokenize(body, options);
  if (tokens.length === 0) return [];
  const recent = await Promise.all(authorRecentBodies.slice(0, RECENT_BODIES).map((b) => tokenize(b, options)));
  return rankTerms(tokens, recent);
}

/**
 * 近いとみなすか。
 * - 重い語（先頭 HEAVY_HEAD 語。固有名詞が来る）が1つ以上共通
 * - または語全体で COMMON_MATCH_MIN 語以上共通
 */
export function isSimilar(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const headB = new Set(b.slice(0, HEAVY_HEAD));
  for (const w of a.slice(0, HEAVY_HEAD)) {
    if (headB.has(w)) return true;
  }
  const all = new Set(b);
  let shared = 0;
  for (const w of new Set(a)) {
    if (all.has(w) && ++shared >= COMMON_MATCH_MIN) return true;
  }
  return false;
}

export type Candidate = {
  id: string;
  authorId: string;
  terms: readonly string[];
  /** 読み手にとって伏せられるか。伏せられる投稿へは案内しない。 */
  veiled: boolean;
};

/**
 * 近い投稿を1件だけ選ぶ。candidates は新しい順（先に見つかったものが最新）。
 *
 * 落とすもの:
 * - 自分自身と、同じ書き手の投稿（「近いことを書いた人がいます」は他人のこと）
 * - 読み手にとって伏せられる投稿（近い投稿があること自体が地雷語の存在を示すため）
 * - 読み手のタイムラインに載っていない投稿（candidates に入れないことで担保する）
 */
export function pickSimilar(target: Candidate, candidates: readonly Candidate[]): { postId: string } | null {
  for (const c of candidates) {
    if (c.id === target.id || c.authorId === target.authorId || c.veiled) continue;
    if (isSimilar(target.terms, c.terms)) return { postId: c.id };
  }
  return null;
}
