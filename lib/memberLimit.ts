/** 新しい箱の定員。CIRCLE_MEMBER_LIMIT が 1 以上の整数ならそれ、それ以外は 30。既存の箱には効かない。 */
export function memberLimit(env: string | undefined = process.env.CIRCLE_MEMBER_LIMIT): number {
  const n = Number(env);
  return Number.isInteger(n) && n > 0 ? n : 30;
}
