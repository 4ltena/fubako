/** 語そのものはサーバーに留め、ブラウザーへは関連IDと強さだけを渡す。 */
export const HEAVY_HEAD = 3;
export const COMMON_MATCH_MIN = 2;
export const RELATED_POST_LIMIT = 10;
export type RelatedPost = { postId: string; strength: number };
type Candidate = { id: string; authorId: string; terms: readonly string[]; veiled: boolean };

export function isSimilar(a: readonly string[], b: readonly string[]): boolean {
  if (!a.length || !b.length) return false;
  const head = new Set(b.slice(0, HEAVY_HEAD));
  if (a.slice(0, HEAVY_HEAD).some((word) => head.has(word))) return true;
  const all = new Set(b);
  return [...new Set(a)].filter((word) => all.has(word)).length >= COMMON_MATCH_MIN;
}

/** 上位語に重みを付けたJaccard係数。意味の一致確率ではない。 */
export function similarityStrength(a: readonly string[], b: readonly string[]): number {
  if (!isSimilar(a, b)) return 0;
  const weights = (terms: readonly string[]) => new Map([...new Set(terms)].map((word, i) => [word, i < HEAVY_HEAD ? 2 : 1]));
  const left = weights(a), right = weights(b);
  let shared = 0, total = 0;
  for (const word of new Set([...left.keys(), ...right.keys()])) {
    shared += Math.min(left.get(word) ?? 0, right.get(word) ?? 0);
    total += Math.max(left.get(word) ?? 0, right.get(word) ?? 0);
  }
  return shared / total;
}

export function relatedPosts(target: Candidate, candidates: readonly Candidate[]): RelatedPost[] {
  if (target.veiled) return [];
  return candidates
    .filter((other) => !other.veiled && other.id !== target.id && other.authorId !== target.authorId)
    .map((other) => ({ postId: other.id, strength: similarityStrength(target.terms, other.terms) }))
    .filter((link) => link.strength > 0)
    .sort((a, b) => b.strength - a.strength || a.postId.localeCompare(b.postId))
    .slice(0, RELATED_POST_LIMIT);
}
