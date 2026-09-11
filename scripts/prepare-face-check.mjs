import { createHash } from "node:crypto";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ORT_VERSION = "1.29.0";
export const MODEL_HASH = "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4";
export async function prepareFaceCheck(root = fileURLToPath(new URL("../", import.meta.url))) {
  const vendor = path.join(root, "vendor/face-check"), ort = path.join(root, "node_modules/onnxruntime-web");
  const modelName = "face_detection_yunet_2023mar.onnx";
  const modelPath = path.join(vendor, "yunet-2023mar", modelName);
  const model = await readFile(modelPath);
  if (model.length !== 232589 || createHash("sha256").update(model).digest("hex") !== MODEL_HASH) throw new Error("YuNetモデルのハッシュが一致しません");
  const pkg = JSON.parse(await readFile(path.join(ort, "package.json"), "utf8"));
  if (pkg.version !== ORT_VERSION) throw new Error("ORTの版が一致しません");
  const pairs = [
    [modelPath, `yunet-2023mar/${modelName}`],
    [path.join(vendor, "yunet-2023mar/LICENSE"), "yunet-2023mar/LICENSE"],
    ...["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"].map((name) => [path.join(ort, "dist", name), `ort-${ORT_VERSION}/${name}`]),
    ...["LICENSE", "ThirdPartyNotices.txt"].map((name) => [path.join(vendor, `ort-${ORT_VERSION}`, name), `ort-${ORT_VERSION}/${name}`]),
  ];
  // 欠損を確認してからコピーする。ここではネットワーク取得を行わない。
  for (const [source] of pairs) await readFile(source);
  for (const [source, relative] of pairs) {
    const target = path.join(root, "public/face-check", relative);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareFaceCheck();
  console.log("顔判定の固定資産を準備しました");
}
