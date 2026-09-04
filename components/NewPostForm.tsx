"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { browserStore, clearDraft, loadDraft, saveDraft } from "@/lib/draft";

const MAX_EDGE = 2048;
const MAX_IMAGES = 4;
const DAYS = [1, 3, 7];

/** 端末の写真を長辺 2048px の JPEG に縮める。EXIF の向きは createImageBitmap が適用する。 */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85));
}

export function NewPostForm({
  circleId,
  suggested,
  declaredWords,
  draftKey,
  afterPost = "push",
}: {
  circleId: string;
  suggested: string[];
  declaredWords: string[];
  draftKey: string;
  afterPost?: "push" | "back";
}) {
  const router = useRouter();
  const [images, setImages] = useState<{ blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [writingTag, setWritingTag] = useState(false);
  const [writingCw, setWritingCw] = useState(false);
  const [days, setDays] = useState(7);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 書きかけを端末から戻す。DOM に直接入れるので、state もハイドレーションも動かさない。
  useEffect(() => {
    const el = bodyRef.current;
    if (el && el.value === "") el.value = loadDraft(draftKey, browserStore(), Date.now());
  }, [draftKey]);

  /** 打つたびに残す（少し待ってから）。件数も「下書きがあります」も出さない。 */
  function keep(body: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDraft(draftKey, body, browserStore(), Date.now()), 600);
  }

  async function pick(files: FileList | null) {
    if (!files) return;
    const next = [...images];
    for (const f of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
      const blob = await shrink(f);
      next.push({ blob, url: URL.createObjectURL(blob) });
    }
    setImages(next);
  }

  /** 提案された語は押すだけで入る。自分で書いてもいい。 */
  function toggleTag(t: string) {
    const has = tags.split(/\s+/).filter(Boolean);
    setTags(has.includes(t) ? has.filter((x) => x !== t).join(" ") : [...has, t].join(" "));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.delete("images");
    images.forEach((img, i) => fd.append("images", img.blob, `${i}.jpg`));
    const r = await fetch("/api/posts", { method: "POST", body: fd });
    if (r.ok) {
      // 投げ終わった本文を端末に残さない
      if (timer.current) clearTimeout(timer.current);
      clearDraft(draftKey, browserStore());
      // 重ねて出しているときは履歴を1つ戻す（push すると「戻る」でまた開く）
      if (afterPost === "back") router.back();
      else router.push(`/c/${circleId}`);
      router.refresh();
      return;
    }
    setError(r.status === 413 ? "画像が大きすぎます。枚数を減らしてください" : "投げられませんでした");
    setBusy(false);
  }

  const chosen = tags.split(/\s+/).filter(Boolean);
  return (
    <form onSubmit={submit} className="space-y-5">
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="tags" value={tags} />
      <input type="hidden" name="days" value={days} />

      <textarea
        ref={bodyRef}
        name="body"
        required={images.length === 0}
        maxLength={2000}
        rows={5}
        autoFocus
        onChange={(e) => keep(e.target.value)}
        placeholder={images.length > 0 ? "写真だけでもいい" : "雑に投げる"}
        className="block w-full resize-none border-b border-line bg-transparent pb-3 text-[17px] leading-[1.9] placeholder:text-ink-faint focus:outline-none"
      />

      {images.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <li key={img.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="aspect-square w-full object-cover" />
              <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="外す" className="absolute right-1 top-1 bg-paper/90 px-2 text-xs">×</button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {images.length < MAX_IMAGES && (
          <button type="button" onClick={() => fileRef.current?.click()} className="label flex size-9 items-center justify-center rounded-full border border-line-2 text-[15px] text-ink-dim">＋</button>
        )}
        <input ref={fileRef} type="file" name="images" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => pick(e.target.files)} className="hidden" />
        {!writingTag && (
          <button type="button" onClick={() => setWritingTag(true)} className="label rounded-full border border-line-2 px-3 py-1.5 text-xs text-ink-dim">
            じぶんで書く
          </button>
        )}
        {suggested.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggleTag(t)}
            aria-pressed={chosen.includes(t)}
            className={`label rounded-full border px-3 py-1.5 text-xs ${chosen.includes(t) ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-dim"}`}
          >
            #{t}
          </button>
        ))}
        {!writingCw && (
          <button type="button" onClick={() => setWritingCw(true)} className="label rounded-full border border-dashed border-line-2 px-3 py-1.5 text-xs text-ink-dim">
            先に断る…
          </button>
        )}
      </div>
      {writingTag && (
        <input
          autoFocus
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          maxLength={100}
          placeholder="空白で区切る"
          className="block w-full border-b border-line bg-transparent pb-2 text-sm placeholder:text-ink-faint focus:outline-none"
        />
      )}
      {writingCw && (
        <input name="cw" maxLength={60} autoFocus placeholder="注意文。付けると全員に対して伏せて届く" className="block w-full border-b border-line bg-transparent pb-2 text-sm placeholder:text-ink-faint focus:outline-none" />
      )}

      {declaredWords.length > 0 && (
        <p className="label text-[11px] leading-[1.9] text-ink-faint">この箱で宣言されている語: {declaredWords.join("　")}</p>
      )}

      <div className="flex items-center gap-3">
        <span className="label text-[11px] text-ink-faint">7日で消える</span>
        <div className="label flex gap-3 text-[11px] text-ink-faint">
          {DAYS.filter((d) => d !== 7).map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d} className={days === d ? "text-ink underline underline-offset-4" : ""}>
              {d}日
            </button>
          ))}
        </div>
      </div>

      {error && <p className="label text-[11px] text-ink">{error}</p>}
      <button disabled={busy} className="label w-full rounded-full bg-ink py-[16px] text-sm tracking-[0.2em] text-paper disabled:opacity-50">投げる</button>
    </form>
  );
}
