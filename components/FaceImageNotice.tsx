import type { FaceResult } from "@/lib/face-check";
import { faceSubmissionState } from "@/lib/face-check";

export function FaceImageNotice({ images, results, visibility, confirmed, onConfirm, onReview }: {
  images: { id: string }[]; results: Record<string, FaceResult>; visibility: "circle" | "private";
  confirmed: boolean; onConfirm: (checked: boolean) => void; onReview: (id: string) => void;
}) {
  if (!images.length) return null;
  const { checking, needsConfirmation } = faceSubmissionState(images.map((image) => image.id), results);
  const detected = images.flatMap((image, index) => results[image.id]?.status === "detected" ? [index + 1] : []);
  const unavailable = images.flatMap((image, index) => results[image.id]?.status === "unavailable" ? [index + 1] : []);
  const targets = images.filter((image) => ["detected", "unavailable"].includes(results[image.id]?.status));
  return <div className="space-y-2 border-l-2 border-line-2 pl-3 text-[13px] leading-[1.9]">
    <div aria-live="polite" aria-atomic="true">
      {checking && <p>写真を確認中…</p>}
      {detected.length > 0 && <p>写真{detected.join("・")}に顔が写っている可能性があります。{visibility === "private" ? "保存してよい写真か確かめてください。" : "写っている方に配慮して、公開してよい写真か確かめてください。"}</p>}
      {unavailable.length > 0 && <p>写真{unavailable.join("・")}を確認できませんでした。写真の内容をご自身で確かめてから{visibility === "private" ? "保存" : "投稿"}してください。</p>}
    </div>
    {targets.map((image) => {
      const result = results[image.id], index = images.findIndex((item) => item.id === image.id) + 1;
      return <div key={image.id}>
        <button type="button" className="min-h-11 py-2 text-left underline underline-offset-4" onClick={() => onReview(image.id)}>写真{index}を拡大して確認</button>
        {result.status === "unavailable" && <p className="text-xs text-ink-dim">{result.reason === "timeout" ? "時間内に確認できませんでした" : "この環境では確認できませんでした"}</p>}
      </div>;
    })}
    {needsConfirmation && <label className="flex min-h-11 items-center gap-3 py-2">
      <input type="checkbox" checked={confirmed} disabled={checking} onChange={(event) => onConfirm(event.target.checked)} className="size-5 shrink-0 accent-ink" />写真を確認しました
    </label>}
    <p className="text-xs text-ink-dim">顔の見落としがあります。写真の内容はご自身でも確かめてください。</p>
  </div>;
}
