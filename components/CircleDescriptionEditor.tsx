"use client";

import { useState } from "react";
import { CIRCLE_DESCRIPTION_MAX_LENGTH } from "@/lib/circle-description";

export function CircleDescriptionEditor({ circleId, initialDescription }: { circleId: string; initialDescription: string }) {
  const [description, setDescription] = useState(initialDescription);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/circles/${circleId}/description`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ description }),
      });
      if (!response.ok) throw new Error("save");
      setDescription(((await response.json()) as { description: string }).description);
      setNotice("保存しました。");
    } catch {
      setNotice("保存できませんでした。内容はそのまま残しています。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-line pt-4">
      <div>
        <h2 className="text-[15px] font-medium">この箱について</h2>
        <p className="mt-1 text-[12px] leading-6 text-ink-faint">書いてよい話題や、ネタバレへの配慮を残せます。参加者にだけ表示されます。</p>
      </div>
      <form className="space-y-3" onSubmit={save}>
        <label className="sr-only" htmlFor="circle-description">この箱について</label>
        <textarea id="circle-description" value={description} onChange={(event) => { setDescription(event.target.value); setNotice(""); }} maxLength={CIRCLE_DESCRIPTION_MAX_LENGTH} rows={5} className="w-full rounded border border-line-2 bg-paper px-3 py-3 text-[15px] leading-7 text-ink" placeholder="この箱で大切にしたいことを書いておく" disabled={busy} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-faint">{Array.from(description).length} / {CIRCLE_DESCRIPTION_MAX_LENGTH}</p>
          <button type="submit" disabled={busy} className="label min-h-11 rounded-full border border-line-2 px-4 py-2 text-[11px] text-ink-dim">{busy ? "保存中…" : "説明を保存する"}</button>
        </div>
      </form>
      {notice && <p role={notice === "保存しました。" ? "status" : "alert"} className="text-[12px] leading-6 text-ink-dim">{notice}</p>}
    </section>
  );
}
