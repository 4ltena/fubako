"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/** fetch を1本投げて画面を更新するだけのボタン。 */
export function ActionButton({ method, url, body, children, confirm, ...rest }: { method: "POST" | "PATCH" | "DELETE"; url: string; body?: unknown; children: ReactNode; confirm?: { title: string; description?: string; confirmLabel?: string; destructive?: boolean } } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmation = confirm ?? (method === "DELETE" ? { title: "削除しますか？", description: "削除した紙は、じぶんの箱からも読めなくなります。", confirmLabel: "削除する", destructive: true } : null);
  async function run() {
    setBusy(true);
    try {
      const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }
  return (
    <>
      <button {...rest} disabled={busy} onClick={() => confirmation ? setConfirming(true) : void run()}>{children}</button>
      {confirmation && <ConfirmDialog open={confirming} title={confirmation.title} description={confirmation.description} confirmLabel={confirmation.confirmLabel ?? "続ける"} destructive={confirmation.destructive} busy={busy} onConfirm={run} onCancel={() => setConfirming(false)} />}
    </>
  );
}
