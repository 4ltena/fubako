"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

export function NewPostForm({ circleId, suggested }: { circleId: string; suggested: string[] }) {
  const router = useRouter();
  const [images, setImages] = useState<{ blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [days, setDays] = useState(7);

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
      router.push(`/c/${circleId}`);
      router.refresh();
      return;
    }
    setError(r.status === 413 ? "画像が大きすぎます。枚数を減らしてください" : "投げられませんでした");
    setBusy(false);
  }

  const chosen = tags.split(/\s+/).filter(Boolean);
  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="tags" value={tags} />
      <input type="hidden" name="days" value={days} />

      <div className="rounded-[28px] bg-card px-6 py-6 shadow-paper">
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={5}
          autoFocus
          placeholder="雑に投げる"
          className="ruled-wide block w-full resize-none bg-transparent text-[16px] leading-[36px] placeholder:text-ink-pale focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-3.5 rounded-[28px] bg-card px-6 py-5 shadow-paper">
        <span className="label text-[11px] tracking-[0.2em] text-ink-soft">タグ　—　このサークルでよく使う語</span>
        <div className="flex flex-wrap gap-2">
          {suggested.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              aria-pressed={chosen.includes(t)}
              className={`label rounded-full px-4 py-2 text-xs tracking-[0.06em] ${chosen.includes(t) ? "bg-sage-fill text-sage-deep" : "bg-veil text-ink-faint"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          maxLength={100}
          placeholder="じぶんで書く（空白区切り）"
          className="rounded-full bg-veil px-5 py-2.5 text-sm placeholder:text-ink-pale focus:outline-none"
        />
        <p className="text-xs leading-[2] text-ink-faint">つけなくても投げられます。ないときは、宣言している人にだけ伏せて届きます。</p>
      </div>

      <div className="flex flex-col gap-3.5 rounded-[28px] bg-card px-6 py-5 shadow-paper">
        <span className="label text-[11px] tracking-[0.2em] text-ink-soft">みんなから見えなくなるまで</span>
        <div className="label flex gap-1.5 rounded-full bg-veil p-1.5 text-xs tracking-[0.1em]">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`flex-1 rounded-full py-2.5 ${days === d ? "bg-card text-accent-deep shadow-paper" : "text-ink-faint"}`}
            >
              {d}日
            </button>
          ))}
        </div>
        <p className="text-xs leading-[2] text-ink-faint">あとから短くできます。じぶんの箱には残ります。</p>
      </div>

      <div className="flex flex-col gap-3.5 rounded-[28px] bg-card px-6 py-5 shadow-paper">
        <span className="label text-[11px] tracking-[0.2em] text-ink-soft">注意文　—　付けると全員に対して伏せて届く</span>
        <input name="cw" maxLength={60} placeholder="書かなくていい" className="rounded-full bg-veil px-5 py-2.5 text-sm placeholder:text-ink-pale focus:outline-none" />
        {images.length < MAX_IMAGES && (
          <input type="file" name="images" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => pick(e.target.files)} className="label text-[11px] text-ink-faint file:mr-3 file:rounded-full file:border-0 file:bg-veil file:px-4 file:py-2 file:text-[11px] file:text-ink-soft" />
        )}
        {images.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {images.map((img, i) => (
              <li key={img.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="aspect-square w-full rounded-[16px] object-cover" />
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="外す" className="absolute right-1 top-1 rounded-full bg-card/90 px-2 text-xs">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="label px-1 text-[11px] text-accent">{error}</p>}
      <button disabled={busy} className="label w-full rounded-full bg-accent py-[18px] text-sm tracking-[0.3em] text-card shadow-lift disabled:opacity-50">投げる</button>
    </form>
  );
}
