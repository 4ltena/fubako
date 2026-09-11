import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareFaceCheck } from "./prepare-face-check.mjs";

test("版とハッシュを照合して同じ資産を再生成し、不正時は失敗する", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fubako-face-assets-"));
  await cp(new URL("../vendor/face-check", import.meta.url), path.join(root, "vendor/face-check"), { recursive: true });
  const ort = path.join(root, "node_modules/onnxruntime-web");
  await mkdir(path.join(ort, "dist"), { recursive: true });
  await writeFile(path.join(ort, "package.json"), JSON.stringify({ version: "1.29.0" }));
  for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) await writeFile(path.join(ort, "dist", file), "fixture");
  await prepareFaceCheck(root);
  const model = path.join(root, "public/face-check/yunet-2023mar/face_detection_yunet_2023mar.onnx");
  const first = await readFile(model); await prepareFaceCheck(root);
  assert.deepEqual(await readFile(model), first);
  await writeFile(path.join(ort, "package.json"), JSON.stringify({ version: "1.28.0" }));
  await assert.rejects(prepareFaceCheck(root), /版が一致/);
  await writeFile(path.join(ort, "package.json"), JSON.stringify({ version: "1.29.0" }));
  await writeFile(path.join(root, "vendor/face-check/yunet-2023mar/face_detection_yunet_2023mar.onnx"), "version https://git-lfs.github.com/spec/v1");
  await assert.rejects(prepareFaceCheck(root), /ハッシュが一致/);
});
