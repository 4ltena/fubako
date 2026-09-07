import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../public/ui-preview/", import.meta.url)));
const port = Number(process.env.PREVIEW_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("PREVIEW_PORT は1024〜65535で指定してください。");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
await readFile(path.join(root, "index.html"));

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
  try {
    let pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    if (pathname.startsWith("/ui-preview/")) pathname = pathname.slice("/ui-preview".length);
    if (pathname === "/") pathname = "/index.html";
    const filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root + path.sep) || pathname.includes("\0")) { res.writeHead(404).end(); return; }
    const content = await readFile(filename);
    res.writeHead(200, { "content-type": mime[path.extname(filename)] ?? "application/octet-stream", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch { res.writeHead(404).end(); }
});
server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? `${port}番ポートは使用中です。現在の開発サーバーを終了してから起動してください。` : `起動できませんでした: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => console.log(`表示確認: http://127.0.0.1:${port}/ui-preview/index.html`));
