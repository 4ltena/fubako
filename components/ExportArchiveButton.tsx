"use client";
import { useRef, useState } from "react";

export function ExportArchiveButton({ month }: { month: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  async function download() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/me/export?month=${encodeURIComponent(month)}`, { cache: "no-store" });
      if (!response.ok || !response.headers.get("Content-Type")?.startsWith("text/plain")) throw new Error("export");
      // ストリームが最後まで完了する前にはダウンロードを開始しない。
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fubako-${month}.txt`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("書き出せませんでした。もう一度試してください。"); }
    finally { running.current = false; setBusy(false); }
  }
  return <div className="label mt-4 text-[12px] text-ink-dim">
    <button type="button" onClick={download} disabled={busy} className="min-h-11 px-1 underline underline-offset-4">{busy ? "書き出しています…" : "この月の記録を書き出す"}</button>
    <p className="leading-[1.8]">自分の本文・注意文・タグ・後書きをテキストで保存します。画像は含まれません。</p>
    {error && <p role="alert" className="mt-2">{error}</p>}
  </div>;
}
