import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "vite";
import { cp } from "node:fs/promises";
import { prepareFaceCheck } from "./prepare-face-check.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
await prepareFaceCheck(root);

await build({
  configFile: false,
  root: path.join(root, "preview"),
  base: "./",
  publicDir: false,
  resolve: {
    alias: [
      { find: "next/navigation", replacement: path.join(root, "preview/navigation.tsx") },
      { find: "next/link", replacement: path.join(root, "preview/link.tsx") },
      { find: "@", replacement: root },
    ],
  },
  plugins: [{
    name: "preview-local-images",
    enforce: "pre",
    transform(source, id) {
      if (id !== path.join(root, "components/PostCard.tsx")) return;
      // プレビューのビルドだけで画像URLを差し替える。通常アプリの部品は変更しない。
      let changed = source;
      let replacements = 0;
      for (const variable of ["id", "open"]) {
        const expression = '`/api/images/${' + variable + '}${imageGrant ? `?grant=${encodeURIComponent(imageGrant)}` : ""}`';
        if (changed.includes(expression)) {
          changed = changed.replaceAll(expression, `previewImageUrl(${variable})`);
          replacements++;
        }
      }
      if (replacements !== 2) throw new Error("PostCardの画像表示が変更されています。プレビューの画像アダプターを更新してください。");
      return { code: `import { previewImageUrl } from ${JSON.stringify(path.join(root, "preview/store.ts"))};\n${changed}`, map: null };
    },
  }],
  build: {
    outDir: path.join(root, "public/ui-preview"),
    emptyOutDir: false,
    modulePreload: false,
    sourcemap: false,
    minify: true,
  },
});
await cp(path.join(root, "public/face-check"), path.join(root, "public/ui-preview/face-check"), { recursive: true });
console.log("表示確認: http://127.0.0.1:3000/ui-preview/index.html");
