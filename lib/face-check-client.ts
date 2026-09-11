import { FACE_TIMEOUT_MS, validatedFaceResult, type FaceResult, type FaceFailure } from "./face-check";

type Image = { id: string; blob: Blob };
type WorkerPort = Pick<Worker, "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror">;
/** 画像変更は同期的に世代を更新する。Reactの再描画前のsubmitにも同じ状態を使う。 */
export class FaceCheckClient {
  generation = 0;
  results: Record<string, FaceResult> = {};
  private worker: WorkerPort | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: Image[] = [];
  constructor(private changed: (results: Record<string, FaceResult>) => void,
    private createWorker: () => WorkerPort = () => new Worker(new URL("../workers/face-check.worker.ts", import.meta.url), { type: "module" }),
    private assetRoot: () => string = () => new URL("/face-check/", window.location.origin).href) {}

  private stop() {
    clearTimeout(this.timer); this.timer = undefined;
    this.worker?.terminate(); this.worker = null;
    this.pending = [];
  }
  dispose() { this.generation++; this.stop(); this.results = {}; }
  setImages(images: readonly Image[]) {
    this.generation++; this.stop();
    const generation = this.generation;
    this.results = Object.fromEntries(images.map(({ id }) => [id, this.results[id]?.status !== "checking" && this.results[id] ? this.results[id] : { status: "checking" }]));
    this.changed(this.results);
    this.pending = images.filter(({ id }) => this.results[id].status === "checking");
    if (!this.pending.length) return;
    const fail = (reason: FaceFailure) => {
      if (generation !== this.generation) return;
      this.results = Object.fromEntries(Object.entries(this.results).map(([id, result]) => [id, result.status === "checking" ? { status: "unavailable", reason } : result]));
      this.stop(); this.changed(this.results);
    };
    this.timer = setTimeout(() => fail("timeout"), FACE_TIMEOUT_MS);
    try {
      const worker = this.createWorker();
      this.worker = worker;
      const next = () => {
        const image = this.pending[0];
        if (!image) { this.stop(); return; }
        worker.postMessage({ type: "detect", generation, imageId: image.id, blob: image.blob });
      };
      worker.onmessage = ({ data }) => {
        if (generation !== this.generation || this.worker !== worker || data?.generation !== generation) return;
        try {
          if (data.type === "ready") next();
          else if (data.type === "failed") fail(data.reason === "unsupported" ? "unsupported" : "load");
          else if (data.type === "result" && data.imageId === this.pending[0]?.id) {
            this.results = { ...this.results, [data.imageId]: validatedFaceResult(data.result) };
            this.pending.shift(); this.changed(this.results); next();
          }
        } catch { fail("inference"); }
      };
      worker.onerror = (event) => { event.preventDefault(); fail("load"); };
      worker.onmessageerror = () => fail("invalid");
      worker.postMessage({ type: "init", generation, assetRoot: this.assetRoot() });
    } catch { fail("unsupported"); }
  }
}
