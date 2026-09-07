"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function CircleLeaveForm({ circleId, transferRequired = false }: { circleId: string; transferRequired?: boolean }) {
  const router = useRouter();
  const [withdraw, setWithdraw] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(transferRequired ? "ほかに会員がいるため、先に管理を引き継いでください。" : "");

  async function leave() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/circles/leave", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ circleId, withdraw: String(withdraw) }),
      });
      if (!response.ok) {
        setConfirming(false);
        setError(response.status === 409 ? "ほかに会員がいるため、先に管理を引き継いでください。" : "退出できませんでした。もう一度試してください。");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setConfirming(false);
      setError("通信できませんでした。もう一度試してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="border-t border-line pt-3">
      <summary className="label flex min-h-11 cursor-pointer items-center py-3 text-[11px] text-ink-dim">この箱を出る</summary>
      <form className="space-y-3 pb-2 pt-2" onSubmit={(event) => { event.preventDefault(); setConfirming(true); }}>
        <label className="flex min-h-11 items-center gap-2 text-[13px] text-ink-dim">
          <input checked={withdraw} onChange={(event) => setWithdraw(event.target.checked)} type="checkbox" className="size-5" />
          公開中の自分の紙も引き取る
        </label>
        {error && <p role="alert" className="text-[13px] leading-6 text-ink-dim">{error}</p>}
        <button type="submit" disabled={busy} className="label min-h-11 rounded-full border border-line-2 px-4 py-2 text-[11px] text-ink-dim">退出を確定する</button>
        <p className="text-[12px] leading-6 text-ink-faint">この操作は取り消せません。書いた紙の記録は残ります。</p>
      </form>
      <ConfirmDialog open={confirming} title="この箱を出ますか" description={withdraw ? "公開中の自分の紙も引き取ります。" : "書いた紙の記録は残ります。"} confirmLabel="退出する" destructive busy={busy} onConfirm={leave} onCancel={() => setConfirming(false)} />
    </details>
  );
}
