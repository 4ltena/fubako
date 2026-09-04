"use client";
import { useState } from "react";
import { INVITE_LENGTH, normalizeInvite } from "@/lib/invite";

/**
 * 招待の言葉を1文字ずつのマスで受ける（デザイン案 1d）。
 *
 * 実体は透明な入力欄1つで、IME の変換を邪魔しない。
 * 古い英数字の言葉も通すので、ひらがな10文字に収まらない入力はそのまま送る。
 */
export function InviteBoxes({ from }: { from: string }) {
  const [value, setValue] = useState("");
  const word = normalizeInvite(value);
  const chars = [...word];
  // 古い英数字の言葉や、貼り付けたリンクはマスに収まらない。そのときは素の欄に戻す。
  const asBoxes = chars.length <= INVITE_LENGTH;
  return (
    <form method="post" action="/api/circles/join" className="flex flex-col gap-[30px]">
      <input type="hidden" name="from" value={from} />
      <label className="relative block">
        <span className="sr-only">招待の言葉</span>
        <input
          name="inviteCode"
          required
          maxLength={60}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        />
        {asBoxes ? (
          <span className="flex gap-1.5" aria-hidden>
            {Array.from({ length: INVITE_LENGTH }, (_, i) => (
              <span
                key={i}
                className={`min-w-0 flex-1 border-b py-4 text-center text-lg ${chars[i] ? "border-ink bg-veil" : "border-line-2 bg-veil"}`}
              >
                {chars[i] ?? "　"}
              </span>
            ))}
          </span>
        ) : (
          <span aria-hidden className="block truncate border-b border-ink bg-veil px-6 py-4 text-[15px]">{value}</span>
        )}
      </label>
      <button className="label w-full rounded-full bg-ink py-[18px] text-sm tracking-[0.2em] text-paper">入る</button>
    </form>
  );
}
