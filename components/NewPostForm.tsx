"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_EDGE = 2048;
const MAX_IMAGES = 4;

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

  async function pick(files: FileList | null) {
    if (!files) return;
    const next = [...images];
    for (const f of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
      const blob = await shrink(f);
      next.push({ blob, url: URL.createObjectURL(blob) });
    }
    setImages(next);
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

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="circleId" value={circleId} />
      <textarea name="body" required maxLength={2000} rows={6} autoFocus placeholder="雑に投げる" className="w-full rounded border border-line bg-card px-3 py-2" />
      <input name="cw" maxLength={60} placeholder="注意文（任意。付けると全員に対して畳まれます）" className="w-full rounded border border-line bg-card px-3 py-2 text-sm" />
      <div>
        <input name="tags" list="tag-suggest" placeholder="タグ（空白区切り・任意。無ければ地雷宣言中の人には伏せられます）" className="w-full rounded border border-line bg-card px-3 py-2 text-sm" />
        <datalist id="tag-suggest">{suggested.map((t) => <option key={t} value={t} />)}</datalist>
        {suggested.length > 0 && <p className="mt-1 text-xs text-ink-soft">よく使われている語: {suggested.join("、")}</p>}
      </div>
      <div className="space-y-2">
        {images.length < MAX_IMAGES && (
          <input type="file" name="images" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => pick(e.target.files)} className="text-sm" />
        )}
        {images.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {images.map((img, i) => (
              <li key={img.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="aspect-square w-full rounded object-cover" />
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="外す" className="absolute right-1 top-1 rounded-full bg-paper/90 px-2 text-xs">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-3">
        <select name="days" defaultValue="7" className="rounded border border-line bg-card px-2 py-2 text-sm">
          <option value="1">1日で消える</option>
          <option value="3">3日で消える</option>
          <option value="7">7日で消える</option>
        </select>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button disabled={busy} className="ml-auto rounded bg-accent px-4 py-2 text-paper disabled:opacity-50">投げる</button>
      </div>
    </form>
  );
}
