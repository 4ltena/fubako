import * as ort from "onnxruntime-web/wasm";
import { decodeFaces, resizedFaceImage, FACE_INPUT_SIZE, type FaceRequest, type FaceReply, type FaceFailure } from "../lib/face-check";

let session: ort.InferenceSession | undefined;
let generation = -1;
let running = false;
const reply = (message: unknown) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<FaceRequest>) => {
  const message = event.data;
  if (message.type === "init") {
    generation = message.generation;
    try {
      if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
        reply({ type: "failed", generation, reason: "unsupported" }); return;
      }
      const root = new URL(message.assetRoot);
      if (root.origin !== self.location.origin) throw new Error("資産の取得先が不正です");
      ort.env.logLevel = "fatal";
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = new URL("ort-1.29.0/", root).href;
      session = await ort.InferenceSession.create(new URL("yunet-2023mar/face_detection_yunet_2023mar.onnx", root).href, { executionProviders: ["wasm"], logSeverityLevel: 4 });
      if (session.inputNames.length !== 1 || session.inputNames[0] !== "input") throw new Error("モデル入力が不正です");
      reply({ type: "ready", generation });
    } catch { reply({ type: "failed", generation, reason: "load" }); }
    return;
  }
  if (message.type !== "detect" || message.generation !== generation || running || !session) return;
  running = true;
  let bitmap: ImageBitmap | undefined, tensor: ort.Tensor | undefined, outputs: ort.InferenceSession.ReturnType | undefined;
  let reason: FaceFailure = "decode";
  try {
    bitmap = await createImageBitmap(message.blob);
    const { width, height } = bitmap, resized = resizedFaceImage(width, height);
    const canvas = new OffscreenCanvas(FACE_INPUT_SIZE, FACE_INPUT_SIZE), context = canvas.getContext("2d");
    if (!context) throw new Error("Canvasを利用できません");
    context.fillStyle = "#000"; context.fillRect(0, 0, FACE_INPUT_SIZE, FACE_INPUT_SIZE);
    context.drawImage(bitmap, 0, 0, resized.width, resized.height);
    const rgba = context.getImageData(0, 0, FACE_INPUT_SIZE, FACE_INPUT_SIZE).data;
    const area = FACE_INPUT_SIZE ** 2, data = new Float32Array(area * 3);
    for (let i = 0; i < area; i++) { data[i] = rgba[i * 4 + 2]; data[area + i] = rgba[i * 4 + 1]; data[area * 2 + i] = rgba[i * 4]; }
    reason = "inference";
    tensor = new ort.Tensor("float32", data, [1, 3, FACE_INPUT_SIZE, FACE_INPUT_SIZE]);
    outputs = await session.run({ input: tensor });
    reason = "invalid";
    const numeric = Object.fromEntries(Object.entries(outputs).map(([name, output]) => {
      if (output.type !== "float32") throw new Error("モデル出力型が不正です");
      return [name, { dims: output.dims, data: output.data as Float32Array }];
    }));
    reply({ type: "result", generation, imageId: message.imageId, result: decodeFaces(numeric, width, height) } satisfies FaceReply);
  } catch { reply({ type: "result", generation, imageId: message.imageId, result: { status: "unavailable", reason } } satisfies FaceReply); }
  finally {
    bitmap?.close(); tensor?.dispose();
    if (outputs) for (const output of Object.values(outputs)) output.dispose();
    running = false;
  }
};
