"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { browserStore, clearDraft, type Draft, type DraftVisibility, loadDraft, saveCurrentDraft } from "@/lib/draft";
import { FaceCheckClient } from "@/lib/face-check-client";
import { faceSubmissionState, type FaceResult } from "@/lib/face-check";
import { FaceImageNotice } from "@/components/FaceImageNotice";
import { FaceImageReview } from "@/components/FaceImageReview";

const MAX_EDGE = 2048;
const MAX_IMAGES = 4;
const DAYS = [7, 1, 3];
type ImageItem = { id: string; blob: Blob; url: string };

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("toBlob")), "image/jpeg", .85));
}

export function NewPostForm({ circleId, suggested, draftKey, afterPost = "push" }: { circleId: string; suggested: string[]; draftKey: string; afterPost?: "push" | "back" }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [cw, setCw] = useState("");
  const [tags, setTags] = useState("");
  const [days, setDays] = useState(7);
  const [visibility, setVisibility] = useState<DraftVisibility>("circle");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [faceResults, setFaceResults] = useState<Record<string, FaceResult>>({});
  const [faceCheck] = useState(() => new FaceCheckClient(setFaceResults));
  const [confirmed, setConfirmed] = useState(false);
  const confirmation = useRef<{ generation: number; visibility: DraftVisibility } | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const photoHeading = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writingTag, setWritingTag] = useState(false);
  const [writingCw, setWritingCw] = useState(false);
  const [readyState, setReadyState] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<Draft>({ body: "", cw: "", tags: "", days: 7, visibility: "circle" });
  const imagesRef = useRef<ImageItem[]>([]);
  const requestId = useRef("");
  const ready = useRef(false);
  const submitting = useRef(false);
  const generation = useRef(0);

  function newRequest() { requestId.current = crypto.randomUUID(); }
  function clearConfirmation() { confirmation.current = null; setConfirmed(false); }
  function revoke(items: ImageItem[]) { items.forEach((image) => URL.revokeObjectURL(image.url)); }
  function saveCurrent() {
    if (!ready.current || submitting.current) return;
    if (!saveCurrentDraft(draftKey, draftRef.current, browserStore())) setError("この端末に書きかけを残せませんでした。送信はできます。");
  }
  function setDraft(next: Partial<Draft>) {
    draftRef.current = { ...draftRef.current, ...next };
    if ("body" in next) setBody(next.body!);
    if ("cw" in next) setCw(next.cw!);
    if ("tags" in next) setTags(next.tags!);
    if ("days" in next) setDays(next.days!);
    if ("visibility" in next) { setVisibility(next.visibility!); clearConfirmation(); }
    newRequest();
    saveCurrent();
  }
  function replaceImages(next: ImageItem[]) {
    imagesRef.current = next;
    clearConfirmation();
    faceCheck.setImages(next);
    setReviewId((old) => next.some((image) => image.id === old) ? old : null);
    setImages(next);
  }
  function resetImages() {
    generation.current += 1;
    setPicking(false);
    revoke(imagesRef.current);
    replaceImages([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  useEffect(() => {
    const restore = setTimeout(() => {
      const saved = loadDraft(draftKey, browserStore(), Date.now());
      draftRef.current = saved;
      setImages([]); setFaceResults({}); setReviewId(null); setConfirmed(false); confirmation.current = null;
      setBody(saved.body); setCw(saved.cw); setTags(saved.tags); setDays(saved.days); setVisibility(saved.visibility);
      setWritingTag(Boolean(saved.tags)); setWritingCw(Boolean(saved.cw));
      newRequest(); ready.current = true; setReadyState(true);
    });
    return () => {
      clearTimeout(restore);
      generation.current += 1;
      revoke(imagesRef.current);
      imagesRef.current = [];
      faceCheck.dispose();
    };
  }, [draftKey, faceCheck]);

  function discard() {
    if (busy) return;
    draftRef.current = { body: "", cw: "", tags: "", days: 7, visibility: "circle" };
    setBody(""); setCw(""); setTags(""); setDays(7); setVisibility("circle"); setError(null);
    resetImages();
    clearDraft(draftKey, browserStore());
    newRequest();
  }
  async function pick(files: FileList | null) {
    if (!files || busy || picking) return;
    const pickGeneration = generation.current;
    const remaining = MAX_IMAGES - imagesRef.current.length;
    if (remaining < 1) return;
    setPicking(true);
    const created: ImageItem[] = [];
    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        const blob = await shrink(file);
        if (generation.current !== pickGeneration || submitting.current) { revoke(created); return; }
        created.push({ id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) });
      }
      if (generation.current === pickGeneration && !submitting.current) {
        replaceImages([...imagesRef.current, ...created]);
        newRequest();
      } else revoke(created);
    } catch {
      if (generation.current === pickGeneration) setError("写真を読み込めませんでした。別の写真を選んでください。");
      revoke(created);
    } finally {
      if (generation.current === pickGeneration) setPicking(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function removeImage(index: number) {
    if (busy || picking) return;
    const removed = imagesRef.current[index];
    if (removed) URL.revokeObjectURL(removed.url);
    replaceImages(imagesRef.current.filter((_, itemIndex) => itemIndex !== index));
    newRequest();
  }
  function toggleTag(tag: string) {
    const current = draftRef.current.tags.split(/\s+/).filter(Boolean);
    setDraft({ tags: current.includes(tag) ? current.filter((word) => word !== tag).join(" ") : [...current, tag].join(" ") });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || picking || !ready.current) return;
    const faces = faceSubmissionState(imagesRef.current.map((image) => image.id), faceCheck.results);
    if (faces.checking || (faces.needsConfirmation && (confirmation.current?.generation !== faceCheck.generation || confirmation.current?.visibility !== draftRef.current.visibility))) return;
    submitting.current = true;
    setBusy(true); setError(null);
    const snapshot = draftRef.current;
    const fd = new FormData();
    fd.set("circleId", circleId); fd.set("body", snapshot.body); fd.set("cw", snapshot.cw); fd.set("tags", snapshot.tags); fd.set("visibility", snapshot.visibility); fd.set("clientRequestId", requestId.current);
    if (snapshot.visibility === "circle") fd.set("days", String(snapshot.days));
    imagesRef.current.forEach((image, index) => fd.append("images", image.blob, `${index}.jpg`));
    try {
      const response = await fetch("/api/posts", { method: "POST", body: fd });
      if (!response.ok) {
        setError(response.status === 413 ? "画像が大きすぎます。枚数を減らしてください。" : "投げられませんでした。内容は残して、もう一度試せます。");
        return;
      }
      generation.current += 1;
      clearDraft(draftKey, browserStore());
      revoke(imagesRef.current); replaceImages([]);
      if (snapshot.visibility === "private") router.push("/archive");
      else if (afterPost === "back") router.back(); else router.push(`/c/${circleId}`);
      router.refresh();
    } catch {
      setError("通信できませんでした。内容は残して、もう一度試せます。");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const chosen = tags.split(/\s+/).filter(Boolean);
  const formDisabled = busy || !readyState;
  const faces = faceSubmissionState(images.map((image) => image.id), faceResults);
  const submitDisabled = formDisabled || picking || faces.checking || (faces.needsConfirmation && !confirmed);
  const reviewImage = images.find((image) => image.id === reviewId);
  return <><form onSubmit={submit} className="space-y-5">
    <fieldset disabled={formDisabled} className="space-y-5 disabled:opacity-60">
      <label className="sr-only" htmlFor="post-body">本文</label>
      <textarea id="post-body" name="body" value={body} required={images.length === 0} maxLength={2000} rows={5} autoFocus onChange={(event) => setDraft({ body: event.target.value })} placeholder={images.length ? "写真だけでもいい" : "雑に投げる"} className="block w-full resize-none border-b border-line bg-transparent pb-3 text-[17px] leading-[1.9] placeholder:text-ink-faint focus:outline-none" />
      <div className="flex items-center gap-3"><span className="label text-[12px] text-ink-dim">書きかけはこの端末に24時間残ります</span><button type="button" onClick={discard} className="label ml-auto min-h-11 shrink-0 px-2 text-[12px] text-ink-dim underline underline-offset-4">捨てる</button></div>
      <h3 ref={photoHeading} tabIndex={-1} className="sr-only">添付する写真</h3>
      {images.length > 0 && <><ul className="grid grid-cols-4 gap-2">{images.map((image, index) => <li key={image.id} className="relative">
        <button type="button" onClick={() => setReviewId(image.id)} aria-label={`写真${index + 1}を拡大して確認`} className="block min-h-11 w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt="" className="aspect-square w-full object-cover" />
        </button>
        <button type="button" disabled={picking} onClick={() => removeImage(index)} aria-label={`写真${index + 1}を外す`} className="absolute right-1 top-1 flex size-11 items-center justify-center bg-paper/90 text-sm">×</button>
      </li>)}</ul><p className="label text-[12px] text-ink-dim">写真はこの画面を離れると残りません。</p></>}
      <FaceImageNotice images={images} results={faceResults} visibility={visibility} confirmed={confirmed} onReview={setReviewId} onConfirm={(checked) => {
        if (faceSubmissionState(imagesRef.current.map((image) => image.id), faceCheck.results).checking) return;
        confirmation.current = checked ? { generation: faceCheck.generation, visibility: draftRef.current.visibility } : null;
        setConfirmed(checked);
      }} />
      <div className="flex flex-wrap items-center gap-2">
        {images.length < MAX_IMAGES && <button type="button" disabled={picking} onClick={() => fileRef.current?.click()} aria-label="写真を追加する" className="label flex size-11 items-center justify-center rounded-full border border-line-2 text-[17px] text-ink-dim">＋</button>}
        <input ref={fileRef} disabled={picking} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => void pick(event.target.files)} className="hidden" />
        {!writingTag && <button type="button" onClick={() => setWritingTag(true)} className="label min-h-11 rounded-full border border-line-2 px-3 text-xs text-ink-dim">じぶんで書く</button>}
        {suggested.map((tag) => <button key={tag} type="button" onClick={() => toggleTag(tag)} aria-pressed={chosen.includes(tag)} className={`label min-h-11 rounded-full border px-3 text-xs ${chosen.includes(tag) ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-dim"}`}>#{tag}</button>)}
        {!writingCw && <button type="button" onClick={() => setWritingCw(true)} className="label min-h-11 rounded-full border border-dashed border-line-2 px-3 text-xs text-ink-dim">先に断る…</button>}
      </div>
      {writingTag && <><label className="sr-only" htmlFor="post-tags">タグ</label><input id="post-tags" value={tags} onChange={(event) => setDraft({ tags: event.target.value })} maxLength={100} placeholder="空白で区切る" className="block min-h-11 w-full border-b border-line bg-transparent pb-2 text-sm placeholder:text-ink-faint focus:outline-none" /></>}
      {writingCw && <><label className="sr-only" htmlFor="post-cw">注意文</label><input id="post-cw" value={cw} onChange={(event) => setDraft({ cw: event.target.value })} maxLength={60} placeholder="注意文。付けると全員に対して伏せて届く" className="block min-h-11 w-full border-b border-line bg-transparent pb-2 text-sm placeholder:text-ink-faint focus:outline-none" /></>}
      <fieldset className="space-y-2 border-t border-line pt-4">
        <legend className="label text-[12px] text-ink-dim">保存先</legend>
        <div className="flex flex-wrap gap-2">
          {(["circle", "private"] as const).map((option) => {
            const selected = visibility === option;
            return <label key={option} className={`label flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-xs ${selected ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-dim"}`}>
              <input type="radio" name="visibility" value={option} checked={selected} onChange={() => setDraft({ visibility: option })} className="sr-only" />
              {option === "circle" ? "この箱に公開" : "自分だけに保存"}
            </label>;
          })}
        </div>
        <p className="text-[13px] leading-[1.9] text-ink-dim">{visibility === "private" ? "この箱には公開されず、自分の記録だけに保存します。自動で公開されることはありません。" : "この箱で読めます。公開期間が終わると、自分だけに表示されます。"}</p>
      </fieldset>
      {visibility === "circle" && <><div className="label flex items-center gap-3 text-[12px]">{DAYS.map((day) => <button key={day} type="button" onClick={() => setDraft({ days: day })} aria-pressed={days === day} className={`min-h-11 min-w-11 px-1 ${days === day ? "text-ink underline underline-offset-4" : "text-ink-dim"}`}>{`${day}日間公開`}</button>)}</div></>}
    </fieldset>
    {error && <p role="alert" className="label text-[12px] leading-[1.8] text-ink">{error}</p>}
    <button disabled={submitDisabled} className="label min-h-11 w-full rounded-full bg-ink py-3 text-sm tracking-[0.2em] text-paper disabled:opacity-50">{picking ? "写真を準備しています…" : faces.checking ? "写真を確認中…" : busy ? visibility === "private" ? "保存しています…" : "投げています…" : visibility === "private" ? "自分だけに保存" : "投げる"}</button>
  </form>{reviewImage && <FaceImageReview key={reviewImage.id} url={reviewImage.url} number={images.indexOf(reviewImage) + 1} result={faceResults[reviewImage.id]} onClose={() => setReviewId(null)} fallbackFocus={photoHeading} />}</>;
}
