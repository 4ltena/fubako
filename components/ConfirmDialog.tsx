"use client";
import { useEffect, useId, useRef } from "react";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

/** 破壊的な操作を、実行前にもう一度だけ確かめるための共通ダイアログ。 */
export function ConfirmDialog({
  open, title, description, confirmLabel, cancelLabel = "やめる", destructive = false, busy = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm border border-line-2 bg-paper p-0 text-ink shadow-none backdrop:bg-ink/20"
    >
      <form method="dialog" className="space-y-4 p-5" onSubmit={(event) => { event.preventDefault(); }}>
        <h2 id={titleId} className="text-[17px] font-medium">{title}</h2>
        {description && <p id={descriptionId} className="text-sm leading-[1.8] text-ink-dim">{description}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" autoFocus disabled={busy} onClick={onCancel} className="min-h-11 px-4 text-sm text-ink-dim underline underline-offset-4">
            {cancelLabel}
          </button>
          <button type="button" disabled={busy} onClick={() => void onConfirm()} className={`min-h-11 px-4 text-sm ${destructive ? "bg-ink text-paper" : "border border-line-2"}`}>
            {busy ? "処理中…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
