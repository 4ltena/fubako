import { useState, type ReactNode } from "react";
import { PaperAgeContext } from "@/components/LetterPaper";
export { LetterPaper } from "@/components/LetterPaper";


/** 色の変化を確認するための、プレビューだけの時間指定。 */
export function PaperPreview({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<number | null>(null);
  return <PaperAgeContext.Provider value={days}>
    <details className="paper-preview-controls">
      <summary>紙の時間をためす</summary>
      <div className="paper-preview-settings">
        <label htmlFor="paper-age">紙の色 <output>{days === null ? "投稿日時に合わせる" : days === 0 ? "書いた直後" : `${days}日後`}</output></label>
        <input id="paper-age" type="range" min="0" max="30" value={days ?? 0} onChange={(event) => setDays(Number(event.target.value))} aria-valuetext={days === null ? "投稿日時に合わせる" : `${days}日後`} />
        <div className="paper-preview-scale"><span>書いた直後</span><span>30日後</span></div>
        <button type="button" onClick={() => setDays(null)}>投稿日時に合わせる</button>
        <p>色だけを試せます。投稿の日時や公開期間は変わりません。</p>
      </div>
    </details>
    {children}
  </PaperAgeContext.Provider>;
}

