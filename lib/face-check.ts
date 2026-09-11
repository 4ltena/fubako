/** 座標と判定は投稿前のメモリーだけで扱う。 */
export const FACE_INPUT_SIZE = 640;
export const FACE_SCORE_THRESHOLD = .75;
export const FACE_TIMEOUT_MS = 8000;
export type FaceRect = { x: number; y: number; width: number; height: number };
export type FaceFailure = "timeout" | "unsupported" | "load" | "decode" | "inference" | "invalid";
export type FaceResult =
  | { status: "checking" }
  | { status: "detected" | "not_detected"; width: number; height: number; rects: FaceRect[] }
  | { status: "unavailable"; reason: FaceFailure };
export type FaceReply = { type: "result"; generation: number; imageId: string; result: FaceResult };
export type FaceRequest =
  | { type: "init"; generation: number; assetRoot: string }
  | { type: "detect"; generation: number; imageId: string; blob: Blob };
type Output = { dims: readonly number[]; data: ArrayLike<number> };
const strides = [8, 16, 32];
const channels = { cls: 1, obj: 1, bbox: 4, kps: 10 };
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));

export function resizedFaceImage(width: number, height: number) {
  if (![width, height].every((n) => Number.isInteger(n) && n > 0)) throw new Error("画像寸法が不正です");
  const scale = FACE_INPUT_SIZE / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function faceIoU(a: FaceRect, b: FaceRect): number {
  const intersection = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return intersection / (a.width * a.height + b.width * b.height - intersection);
}

export function decodeFaces(outputs: Record<string, Output>, width: number, height: number): FaceResult {
  const resized = resizedFaceImage(width, height);
  const expected = strides.flatMap((stride) => Object.keys(channels).map((kind) => `${kind}_${stride}`));
  if (Object.keys(outputs).length !== expected.length || expected.some((name) => !outputs[name])) throw new Error("推論出力名が不正です");
  for (const stride of strides) {
    for (const [kind, channel] of Object.entries(channels)) {
      const t = outputs[`${kind}_${stride}`], count = (FACE_INPUT_SIZE / stride) ** 2;
      if (t.dims.length !== 3 || t.dims[0] !== 1 || t.dims[1] !== count || t.dims[2] !== channel || t.data.length !== count * channel) throw new Error("推論出力の形状が不正です");
      for (let i = 0; i < t.data.length; i++) if (!Number.isFinite(t.data[i])) throw new Error("推論値が不正です");
    }
  }
  const candidates: (FaceRect & { score: number; order: number })[] = [];
  for (const stride of strides) {
    const cols = FACE_INPUT_SIZE / stride;
    const cls = outputs[`cls_${stride}`].data, obj = outputs[`obj_${stride}`].data, box = outputs[`bbox_${stride}`].data;
    for (let i = 0; i < cols * cols; i++) {
      const score = Math.sqrt(clamp(cls[i]) * clamp(obj[i]));
      if (score < FACE_SCORE_THRESHOLD) continue;
      const cx = (i % cols + box[i * 4]) * stride, cy = (Math.floor(i / cols) + box[i * 4 + 1]) * stride;
      const w = Math.exp(box[i * 4 + 2]) * stride, h = Math.exp(box[i * 4 + 3]) * stride;
      if (![cx, cy, w, h].every(Number.isFinite) || w <= 0 || h <= 0) throw new Error("候補の寸法が不正です");
      if (cx < 0 || cy < 0 || cx >= resized.width || cy >= resized.height) continue;
      // 縦横の丸め差を含む実倍率でJPEGの座標へ戻す。
      const sx = resized.width / width, sy = resized.height / height;
      const x = clamp((cx - w / 2) / sx, 0, width), y = clamp((cy - h / 2) / sy, 0, height);
      const right = clamp((cx + w / 2) / sx, 0, width), bottom = clamp((cy + h / 2) / sy, 0, height);
      if (right > x && bottom > y) candidates.push({ x, y, width: right - x, height: bottom - y, score, order: candidates.length });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.order - b.order);
  const kept: FaceRect[] = [];
  for (const candidate of candidates) if (!kept.some((box) => faceIoU(candidate, box) > .3)) kept.push(candidate);
  const rects = kept.map((box) => {
    const x = clamp((box.x - box.width * .1) / width), y = clamp((box.y - box.height * .1) / height);
    return { x, y, width: clamp((box.x + box.width * 1.1) / width) - x, height: clamp((box.y + box.height * 1.1) / height) - y };
  });
  return { status: rects.length ? "detected" : "not_detected", width, height, rects };
}

/** Workerから不正な枠が来ても「未検出」にはしない。余分な情報は受け取らない。 */
export function validatedFaceResult(value: unknown): FaceResult {
  const invalid: FaceResult = { status: "unavailable", reason: "invalid" };
  if (!value || typeof value !== "object") return invalid;
  const r = value as Record<string, unknown>;
  if (r.status === "unavailable") return ["timeout", "unsupported", "load", "decode", "inference", "invalid"].includes(String(r.reason)) ? { status: "unavailable", reason: r.reason as FaceFailure } : invalid;
  if ((r.status !== "detected" && r.status !== "not_detected") || ![r.width, r.height].every((n) => typeof n === "number" && Number.isInteger(n) && n > 0) || !Array.isArray(r.rects)) return invalid;
  if ((r.status === "detected") !== (r.rects.length > 0)) return invalid;
  const rects: FaceRect[] = [];
  for (const box of r.rects) {
    if (!box || ![box.x, box.y, box.width, box.height].every((n) => typeof n === "number" && Number.isFinite(n)) || box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0 || box.x + box.width > 1 + 1e-9 || box.y + box.height > 1 + 1e-9) return invalid;
    rects.push({ x: box.x, y: box.y, width: box.width, height: box.height });
  }
  return { status: r.status, width: r.width as number, height: r.height as number, rects };
}

export function faceSubmissionState(ids: readonly string[], results: Readonly<Record<string, FaceResult>>) {
  const checking = ids.some((id) => !results[id] || results[id].status === "checking");
  const needsConfirmation = ids.some((id) => ["detected", "unavailable"].includes(results[id]?.status));
  return { checking, needsConfirmation };
}
