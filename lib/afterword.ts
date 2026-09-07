export const AFTERWORD_MAX_CHARS = 4000;

/** 後書きは本文と別の私的な欄。空文字も保存して消去できる。 */
export function validateAfterword(value: unknown): { afterword: string } | { error: "afterword" | "too_long" } {
  if (typeof value !== "string") return { error: "afterword" };
  if ([...value].length > AFTERWORD_MAX_CHARS) return { error: "too_long" };
  return { afterword: value };
}
