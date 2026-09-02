import { encode } from "blurhash";
import sharp from "sharp";

/**
 * 画像の受け入れ処理。
 * - 向きは画素に焼き込み、EXIF は全て落とす（withMetadata を呼ばない）
 * - 長辺 2048px 以下の WebP 品質 82 に再エンコード。GIF は先頭フレームだけ
 * - 64×64 に縮めた画素から 5×5 の blurhash を作る
 */

export const ACCEPTED_TYPES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_EDGE = 2048;

export async function processImage(input: Buffer): Promise<{ webp: Buffer; blurhash: string; width: number; height: number }> {
  // animated: false が既定なので GIF は先頭フレームになる
  const base = sharp(input).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  const { data: webp, info } = await base.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const small = await base.clone().resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(small.data), small.info.width, small.info.height, 5, 5);
  return { webp, blurhash, width: info.width, height: info.height };
}
