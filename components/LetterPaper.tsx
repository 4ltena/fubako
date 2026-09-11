"use client";

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useReadingPreferences } from "@/components/ReadingPreferences";

/** プレビューだけが渡す時間指定。通常画面では null のまま投稿日時を使う。 */
export const PaperAgeContext = createContext<number | null>(null);

const DAY_MS = 86_400_000;

/**
 * 投稿の中身を便箋として見せる器。初回HTMLは常に書いた直後の紙にし、
 * hydration 後にだけ端末時刻から経年を反映するので、SSR とクライアントでずれない。
 */
export function LetterPaper({ createdAt, ageDays, children, as: Element = "div" }: { createdAt: string; ageDays?: number; children: ReactNode; as?: "div" | "span" }) {
  const previewAgeDays = useContext(PaperAgeContext);
  const { preferences } = useReadingPreferences();
  const fixedAgeDays = ageDays ?? previewAgeDays;
  const [elapsedDays, setElapsedDays] = useState<number>(() => fixedAgeDays ?? 0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    if (fixedAgeDays !== null && fixedAgeDays !== undefined) {
      setElapsedDays(fixedAgeDays);
      return;
    }
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / DAY_MS;
    setElapsedDays(Number.isFinite(elapsed) ? elapsed : 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [createdAt, fixedAgeDays]);

  const age = preferences.paperEffects ? Math.max(0, Math.min(1, elapsedDays / 30)) : 0;
  const style = {
    "--paper-age": `${(age * 100).toFixed(2)}%`,
    "--paper-rule-alpha": (0.19 - age * 0.12).toFixed(3),
  } as CSSProperties;
  return <Element className={`letter-paper${preferences.paperEffects ? "" : " letter-paper--plain"}`} style={style}>{children}</Element>;
}
