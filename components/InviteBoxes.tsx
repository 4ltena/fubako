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
  const boxes = chars.length > INVITE_LENGTH ? chars.length : INVITE_LENGTH;
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
        <span className="flex gap-2" aria-hidden>
          {Array.from({ length: boxes }, (_, i) => (
            <span
              key={i}
              className={`flex-1 rounded-[22px] py-5 text-center text-[22px] tracking-[0.1em] ${
                chars[i] ? "bg-card shadow-paper" : "bg-veil"
              }`}
            >
              {chars[i] ?? "　"}
            </span>
          ))}
        </span>
      </label>
      <button className="label w-full rounded-full bg-accent py-[18px] text-sm tracking-[0.3em] text-card shadow-lift">入る</button>
    </form>
  );
}
