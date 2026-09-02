"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

/** fetch を1本投げて画面を更新するだけのボタン。 */
export function ActionButton({ method, url, body, children, ...rest }: { method: "POST" | "PATCH" | "DELETE"; url: string; body?: unknown; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      {...rest}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(url, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
        router.refresh();
        setBusy(false);
      }}
    >
      {children}
    </button>
  );
}
