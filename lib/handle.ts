/**
 * アカウント名の正規化。見た目が同じ名前でのなりすましを防ぐ。
 * - NFKC で全角英数と互換文字を寄せる
 * - 制御文字・書式文字（ゼロ幅空白など）を落とす
 * - 前後の空白を落とす
 * 一意キー（key）は小文字化したもの。表示名（display）は大文字小文字を保つ。
 */
export function normalizeHandle(raw: string): { key: string; display: string } {
  const display = raw.normalize("NFKC").replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
  return { key: display.toLowerCase(), display };
}
