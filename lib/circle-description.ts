export const CIRCLE_DESCRIPTION_MAX_LENGTH = 500;

/** 箱の説明は改行を含められる平文だけに限る。制御文字と不正な UTF-16 は保存しない。 */
export function validateCircleDescription(value: unknown): { ok: true; description: string } | { ok: false } {
  if (typeof value !== "string") return { ok: false };
  if (Array.from(value).length > CIRCLE_DESCRIPTION_MAX_LENGTH) return { ok: false };
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if ((code >= 0xd800 && code <= 0xdbff && (index + 1 >= value.length || value.charCodeAt(index + 1) < 0xdc00 || value.charCodeAt(index + 1) > 0xdfff))
      || (code >= 0xdc00 && code <= 0xdfff && (index === 0 || value.charCodeAt(index - 1) < 0xd800 || value.charCodeAt(index - 1) > 0xdbff))
      || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)
      || code === 0x7f) return { ok: false };
  }
  return { ok: true, description: value };
}
