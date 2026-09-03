"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 重ねて出す紙の器。
 * 背後のタイムラインは暗幕で覆わず、地の色を薄く敷いて沈めるだけ（デザイン案 1f の注記）。
 */
export function SheetShell({ circleId, title, children }: { circleId: string; title: string; children: React.ReactNode }) {
  const router = useRouter();
  const close = () => router.push(`/c/${circleId}`);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-screen/75 p-5 backdrop-blur-[2px] md:p-10">
      <div className="mx-auto w-full max-w-[592px] rounded-[32px] bg-screen p-6 shadow-lift md:p-8">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[15px] tracking-[0.14em]">{title}</span>
          <button type="button" onClick={close} className="label text-xs tracking-[0.16em] text-ink-faint">とじる</button>
        </div>
        {children}
      </div>
    </div>
  );
}
