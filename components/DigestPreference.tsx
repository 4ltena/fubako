"use client";

import { useState } from "react";

export function DigestPreference({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me/digest", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: String(!enabled) }),
      });
      if (!res.ok) throw new Error("save");
      setEnabled(((await res.json()) as { enabled: boolean }).enabled);
    } catch {
      setError("変更を保存できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border-t border-line pt-4 text-sm">
      <h2 className="font-medium">一日一度の便り</h2>
      <p className="mt-2 leading-relaxed text-ink-dim">{enabled ? "新しい紙や反応をメールで受け取ります。" : "便りを止めています。好きなときに箱を訪れられます。"}</p>
      <button type="button" onClick={toggle} disabled={busy} className="mt-2 min-h-11 border border-line-2 px-4">{enabled ? "便りを止める" : "便りを受け取る"}</button>
      <p className="mt-2 text-xs leading-relaxed text-ink-dim">送信が始まった便りは、停止後に届くことがあります。</p>
      {error && <p role="alert" className="mt-2">{error}</p>}
    </section>
  );
}
