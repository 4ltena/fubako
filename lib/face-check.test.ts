import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeFaces, faceSubmissionState, validatedFaceResult } from "./face-check";
import { FaceCheckClient } from "./face-check-client";

function output() {
  return Object.fromEntries([8, 16, 32].flatMap((s) => Object.entries({ cls: 1, obj: 1, bbox: 4, kps: 10 }).map(([name, channels]) => [`${name}_${s}`, { dims: [1, (640 / s) ** 2, channels], data: new Float32Array((640 / s) ** 2 * channels) }])));
}
function candidate(out: ReturnType<typeof output>, row: number, col: number, score: number, cx: number, cy: number, w: number, h: number) {
  const i = row * 80 + col;
  out.cls_8.data[i] = score; out.obj_8.data[i] = score;
  out.bbox_8.data.set([cx / 8 - col, cy / 8 - row, Math.log(w / 8), Math.log(h / 8)], i * 4);
}
describe("顔候補の座標と出力契約", () => {
  it("未検出としきい値の境界を区別し、同じ顔の枠をまとめる", () => {
    const out = output();
    expect(decodeFaces(out, 640, 640)).toMatchObject({ status: "not_detected", rects: [] });
    candidate(out, 10, 10, .749, 100, 100, 40, 40);
    expect(decodeFaces(out, 640, 640).status).toBe("not_detected");
    candidate(out, 10, 10, .75, 100, 100, 40, 40);
    candidate(out, 10, 11, .9, 101, 101, 40, 40);
    candidate(out, 30, 30, .8, 300, 300, 32, 32);
    const result = decodeFaces(out, 640, 640);
    expect(result.status).toBe("detected");
    if (!("rects" in result)) throw new Error();
    expect(result.rects).toHaveLength(2);
    expect(result.rects[0].x).toBeCloseTo(77 / 640);
    expect(result.rects[0].width).toBeCloseTo(48 / 640);
  });
  it("縦横の丸めと画像端を補正し、パディングのみの候補を除く", () => {
    const out = output();
    candidate(out, 1, 1, 1, 2, 2, 40, 40);
    candidate(out, 50, 30, 1, 400, 500, 40, 40);
    const result = decodeFaces(out, 1001, 333);
    if (!("rects" in result)) throw new Error();
    expect(result.rects).toHaveLength(1);
    expect(result.rects[0].x).toBe(0); expect(result.rects[0].y).toBe(0);
    expect(result.rects[0].height).toBeCloseTo(24.2 / 213);
  });
  it("壊れた出力・非有限値を未検出と扱わない", () => {
    const out = output(); out.kps_32.data[0] = NaN;
    expect(() => decodeFaces(out, 640, 640)).toThrow();
    const shape = output(); shape.cls_8.dims = [6400];
    expect(() => decodeFaces(shape, 640, 640)).toThrow();
    expect(validatedFaceResult({ status: "detected", width: 100, height: 100, rects: [{ x: .9, y: 0, width: .2, height: .2 }] })).toEqual({ status: "unavailable", reason: "invalid" });
    expect(validatedFaceResult({ status: "detected", width: 100, height: 100, rects: [] }).status).toBe("unavailable");
  });
});

class FakeWorker {
  onmessage: Worker["onmessage"] = null; onerror: Worker["onerror"] = null; onmessageerror: Worker["onmessageerror"] = null;
  postMessage = vi.fn(); terminate = vi.fn();
  send(data: unknown) { this.onmessage?.call(this as unknown as Worker, { data } as MessageEvent); }
}
const blank = { status: "not_detected" as const, width: 100, height: 100, rects: [] };
const detected = { status: "detected" as const, width: 100, height: 100, rects: [{ x: .2, y: .2, width: .3, height: .3 }] };
describe("顔判定の画像世代と待機", () => {
  afterEach(() => vi.useRealTimers());
  it("旧世代・削除済み画像・同じ添字の別画像へ結果を流用しない", () => {
    const workers: FakeWorker[] = [];
    const client = new FaceCheckClient(vi.fn(), () => { const w = new FakeWorker(); workers.push(w); return w; }, () => "http://localhost/face-check/");
    client.setImages([{ id: "old", blob: new Blob() }]); const old = client.generation;
    client.setImages([{ id: "new", blob: new Blob() }]);
    workers[0].send({ type: "result", generation: old, imageId: "old", result: detected });
    workers[1].send({ type: "result", generation: client.generation, imageId: "old", result: detected });
    expect(client.results).toEqual({ new: { status: "checking" } });
    workers[1].send({ type: "result", generation: client.generation, imageId: "new", result: blank });
    expect(client.results).toEqual({ new: blank });
    expect(workers.every((w) => w.terminate.mock.calls.length === 1)).toBe(true);
    client.dispose();
  });
  it("8秒後は完了した顔ありを保ち、未完了だけ判定不能にしてWorkerを破棄する", () => {
    vi.useFakeTimers(); const worker = new FakeWorker();
    const client = new FaceCheckClient(vi.fn(), () => worker, () => "http://localhost/face-check/");
    client.setImages([{ id: "a", blob: new Blob() }, { id: "b", blob: new Blob() }]);
    worker.send({ type: "ready", generation: client.generation });
    worker.send({ type: "result", generation: client.generation, imageId: "a", result: detected });
    expect(faceSubmissionState(["a", "b"], client.results)).toEqual({ checking: true, needsConfirmation: true });
    vi.advanceTimersByTime(8000);
    expect(client.results).toEqual({ a: detected, b: { status: "unavailable", reason: "timeout" } });
    expect(faceSubmissionState(["a", "b"], client.results)).toEqual({ checking: false, needsConfirmation: true });
    worker.send({ type: "result", generation: client.generation, imageId: "b", result: blank });
    expect(client.results.b.status).toBe("unavailable");
    expect(worker.terminate).toHaveBeenCalledOnce(); client.dispose();
  });
  it("完了済みの同じ画像だけを再利用し、画像0枚と離脱で処理を終える", () => {
    const worker = new FakeWorker(), factory = vi.fn(() => worker);
    const client = new FaceCheckClient(vi.fn(), factory, () => "http://localhost/face-check/");
    client.setImages([{ id: "a", blob: new Blob() }]);
    worker.send({ type: "result", generation: client.generation, imageId: "a", result: blank });
    client.setImages([{ id: "a", blob: new Blob() }]);
    expect(factory).toHaveBeenCalledOnce();
    client.setImages([]); expect(client.results).toEqual({});
    expect(faceSubmissionState([], client.results)).toEqual({ checking: false, needsConfirmation: false });
    client.dispose();
  });
  it("環境不足と資産取得失敗も確認後に投稿可能な判定不能にする", () => {
    const client = new FaceCheckClient(vi.fn(), () => { throw new Error(); });
    client.setImages([{ id: "a", blob: new Blob() }]);
    expect(client.results.a).toEqual({ status: "unavailable", reason: "unsupported" });
    client.dispose();
    const worker = new FakeWorker(), next = new FaceCheckClient(vi.fn(), () => worker, () => "http://localhost/face-check/");
    next.setImages([{ id: "b", blob: new Blob() }]); worker.send({ type: "failed", generation: next.generation, reason: "load" });
    expect(next.results.b).toEqual({ status: "unavailable", reason: "load" }); next.dispose();
  });
});
