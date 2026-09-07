"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AFTERWORD_MAX_CHARS } from "@/lib/afterword";

/** 書いた本人だけに見える、元の紙を変えない追記欄。 */
export function AfterwordEditor({ postId, initialAfterword }: { postId: string; initialAfterword: string }) {
  const [afterword, setAfterword] = useState(initialAfterword);
  const [saved, setSaved] = useState(initialAfterword);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  const changed = afterword !== saved;

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/posts/${postId}/afterword`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ afterword }),
      });
      if (!response.ok) throw new Error("save");
      const body = (await response.json()) as { afterword: string };
      setAfterword(body.afterword);
      setSaved(body.afterword);
    } catch {
      setError("保存できませんでした。通信を確かめて、もう一度試してください。");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/posts/${postId}/afterword`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete");
      setAfterword("");
      setSaved("");
    } catch {
      setError("消去できませんでした。通信を確かめて、もう一度試してください。");
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <section className="mt-4 border-t border-line pt-3">
      <label htmlFor={`afterword-${postId}`} className="label block text-[12px] text-ink-dim">後書き（自分だけに見えます）</label>
      <textarea
        id={`afterword-${postId}`}
        value={afterword}
        maxLength={AFTERWORD_MAX_CHARS}
        disabled={busy}
        onChange={(event) => setAfterword(event.target.value)}
        className="mt-2 min-h-24 w-full border border-line bg-paper px-3 py-3 text-[14px] leading-[1.8] text-ink focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={save} disabled={!changed || busy} className="label min-h-11 px-3 text-[12px] text-ink underline underline-offset-4 disabled:text-ink-faint">
          {busy ? "保存中" : "保存"}
        </button>
        {saved && (
          <button type="button" onClick={() => setConfirmingDelete(true)} disabled={busy} className="label min-h-11 px-3 text-[12px] text-ink-dim underline underline-offset-4 disabled:text-ink-faint">
            後書きを消す
          </button>
        )}
      </div>
      {error && <p role="alert" className="label mt-2 text-[12px] leading-[1.8] text-ink-dim">{error}</p>}
      <ConfirmDialog
        open={confirmingDelete}
        title="後書きを消しますか"
        description="後書きは自分の箱からも消えます。元の紙は残ります。"
        confirmLabel="後書きを消す"
        destructive
        busy={busy}
        onConfirm={clear}
        onCancel={() => setConfirmingDelete(false)}
      />
    </section>
  );
}
