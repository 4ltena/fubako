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
// クライアント側で長辺 2048px に縮小済みのはずなので 50MP あれば十分足りるが、
// 圧縮率の高い小さなファイルが展開後は巨大な画素数になる「展開爆弾」を防ぐため上限を切る。
// 40M ≈ 6300×6300。
export const MAX_INPUT_PIXELS = 40_000_000;
const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

export async function processImage(input: Buffer): Promise<{ webp: Buffer; blurhash: string; width: number; height: number }> {
  // animated: false が既定なので GIF は先頭フレームになる
  const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
  // クライアント申告の File.type は信用しない。実際にデコードした形式を確認する。
  const { format } = await source.metadata();
  if (!format || !SUPPORTED_FORMATS.has(format)) throw new Error("対応していない画像形式");
  const base = source.rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  const { data: webp, info } = await base.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const small = await base.clone().resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(small.data), small.info.width, small.info.height, 5, 5);
  return { webp, blurhash, width: info.width, height: info.height };
}
