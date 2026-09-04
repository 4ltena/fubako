"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 重ねて出す紙の器。
 * 背後のタイムラインは暗幕で覆わず、地の色を薄く敷いて沈めるだけ（デザイン案 1f の注記）。
 */
export function SheetShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  // 重ねて出したときは履歴を1つ戻す。push で閉じると「戻る」でまた開いてしまう。
  const close = () => router.back();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 変換中の Escape は「候補を取り消す」ためのもの。シートは閉じない。
      if (e.key !== "Escape" || e.isComposing || e.keyCode === 229) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-paper/90 p-5 md:p-10">
      <div className="mx-auto w-full max-w-[600px] bg-paper p-6 md:p-8">
        <div className="mb-5 flex items-center justify-between border-b border-line pb-4">
          <span className="text-[15px] tracking-[0.06em]">{title}</span>
          <button type="button" onClick={close} className="label text-xs tracking-[0.1em] text-ink-faint underline underline-offset-4">とじる</button>
        </div>
        {children}
      </div>
    </div>
  );
}
