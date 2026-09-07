"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TopicMuteRule = { id: string; word: string };

/**
 * 箱ごとの「見るまで伏せる」語。画面には本人の語だけを載せ、箱名や他人の登録状況は扱わない。
 */
export function TopicMuteControls({ circleId, initialRules, allowAdd = true }: { circleId: string; initialRules: TopicMuteRule[]; allowAdd?: boolean }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshRules() {
    const response = await fetch(`/api/me/topic-mutes?circleId=${encodeURIComponent(circleId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("rules");
    const payload = await response.json() as { rules?: unknown };
    if (!Array.isArray(payload.rules) || !payload.rules.every((rule): rule is TopicMuteRule => typeof rule === "object" && rule !== null && typeof rule.id === "string" && typeof rule.word === "string")) throw new Error("rules");
    setRules(payload.rules);
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = word.trim();
    if (!next || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/me/topic-mutes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ circleId, word: next }),
      });
      if (!response.ok) throw new Error("add");
      await refreshRules();
      setWord("");
      // 既に開いていた紙も、次の表示では安全側の判定に戻す。
      router.refresh();
    } catch {
      setError("話題を伏せられませんでした。内容を残して、もう一度試せます。");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const query = new URLSearchParams({ circleId, id });
      const response = await fetch(`/api/me/topic-mutes?${query.toString()}`, { method: "DELETE" });
      if (!response.ok) throw new Error("remove");
      await refreshRules();
      router.refresh();
    } catch {
      setError("話題の伏せを外せませんでした。もう一度試せます。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-line pt-5" aria-labelledby={`topic-mutes-title-${circleId}`}>
      <div className="space-y-1">
        <h2 id={`topic-mutes-title-${circleId}`} className="text-[16px] font-bold">見るまで伏せる話題</h2>
        <p className="text-[13px] leading-[1.9] text-ink-dim">{allowAdd ? "ここに書いた話題を含む紙は、自分には伏せたまま届きます。開くかどうかは、そのとき決められます。" : "以前登録した話題です。外すと、次からはこの話題を含む紙も通常どおり届きます。"}</p>
      </div>
      {allowAdd && <form onSubmit={add} className="flex items-center gap-3">
        <label className="sr-only" htmlFor={`topic-mute-${circleId}`}>伏せる話題</label>
        <input id={`topic-mute-${circleId}`} value={word} onChange={(event) => setWord(event.target.value)} required maxLength={40} disabled={busy} placeholder="話題を書く" className="min-h-11 min-w-0 flex-1 border-b border-line bg-transparent text-[15px] placeholder:text-ink-faint focus:outline-none" />
        <button disabled={busy} className="label min-h-11 shrink-0 rounded-full bg-ink px-5 text-xs tracking-[0.1em] text-paper disabled:opacity-50">伏せる</button>
      </form>}
      {rules.length > 0 && <ul className="flex flex-wrap gap-2.5" aria-label="伏せている話題">
        {rules.map((rule) => <li key={rule.id} className="label flex min-h-11 items-center gap-2 rounded-full border border-line-2 px-3 text-sm">
          <span>{rule.word}</span>
          <button type="button" disabled={busy} onClick={() => void remove(rule.id)} className="flex size-11 items-center justify-center text-ink-dim disabled:opacity-50" aria-label={`${rule.word}を外す`}>×</button>
        </li>)}
      </ul>}
      {error && <p role="alert" className="label text-[12px] leading-[1.8] text-ink">{error}</p>}
    </section>
  );
}
