"use client";
import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { FaceResult } from "@/lib/face-check";
import { constrainReview, fitReview, reviewImageSize, zoomReview, type ReviewCamera, type ReviewPoint, type ReviewSize } from "@/lib/image-review-geometry";

export function FaceImageReview({ url, number, result, onClose, fallbackFocus }: {
  url: string; number: number; result?: FaceResult; onClose: () => void; fallbackFocus: RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null), field = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<ReviewSize | null>(result && "width" in result ? { width: result.width, height: result.height } : null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState<ReviewCamera>({ x: 0, y: 0, zoom: 1 });
  const current = useRef(camera);
  const pointers = useRef(new Map<number, ReviewPoint>());
  const gesture = useRef<{ points: ReviewPoint[]; camera: ReviewCamera } | null>(null);
  const [failed, setFailed] = useState(false);
  function update(next: ReviewCamera) { current.current = next; setCamera(next); }
  function clearGesture() { pointers.current.clear(); gesture.current = null; }
  function reset() { clearGesture(); if (dimensions) update(fitReview(dimensions, viewport)); }
  function zoomBy(factor: number) { if (dimensions) update(zoomReview(current.current, factor, { x: viewport.width / 2, y: viewport.height / 2 }, dimensions, viewport)); }

  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallback = fallbackFocus.current;
    const node = dialog.current!;
    node.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(field.current!);
    const blur = () => { pointers.current.clear(); gesture.current = null; };
    window.addEventListener("blur", blur);
    return () => {
      blur(); observer.disconnect(); node.close(); window.removeEventListener("blur", blur);
      document.body.style.overflow = overflow;
      (previous?.isConnected ? previous : fallback)?.focus({ preventScroll: true });
    };
  }, [fallbackFocus]);

  useLayoutEffect(() => {
    pointers.current.clear(); gesture.current = null;
    if (dimensions) {
      const next = fitReview(dimensions, viewport);
      current.current = next;
      // 画像の実寸と表示領域に合わせ、描画前に全体表示へ戻す。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCamera(next);
    }
  }, [dimensions, viewport]);

  function point(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (!dimensions || event.button !== 0 || pointers.current.size >= 2) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point(event));
    gesture.current = { points: [...pointers.current.values()], camera: current.current };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!dimensions || !gesture.current || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, point(event));
    const before = gesture.current.points, after = [...pointers.current.values()], base = gesture.current.camera;
    if (after.length === 2 && before.length === 2) {
      const middle = (p: ReviewPoint[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
      const distance = (p: ReviewPoint[]) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      update(zoomReview(base, distance(after) / Math.max(1, distance(before)), middle(before), dimensions, viewport, middle(after)));
    } else if (base.zoom > 1) update(constrainReview({ ...base, x: base.x + after[0].x - before[0].x, y: base.y + after[0].y - before[0].y }, dimensions, viewport));
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    gesture.current = pointers.current.size ? { points: [...pointers.current.values()], camera: current.current } : null;
  }
  const fit = dimensions ? reviewImageSize(dimensions, viewport) : null;
  const rects = result?.status === "detected" ? result.rects : [];
  return <dialog ref={dialog} className="face-review" aria-labelledby="face-review-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="flex items-center justify-between gap-4 p-4">
      <h2 id="face-review-title" className="text-lg">写真{number}を確認</h2>
      <button type="button" autoFocus onClick={onClose} className="min-h-11 px-4 underline underline-offset-4">とじる</button>
    </header>
    <div ref={field} className="face-review__field" tabIndex={0} role="region" aria-label="写真。拡大後は矢印キーで移動できます" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={(event) => {
      const delta: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
      if (!dimensions || !delta[event.key]) return;
      event.preventDefault();
      const [dx, dy] = delta[event.key];
      update(constrainReview({ ...current.current, x: current.current.x + dx, y: current.current.y + dy }, dimensions, viewport));
    }}>
      <div className="face-review__image" style={fit ? { width: fit.width, height: fit.height, transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` } : { visibility: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`確認する写真${number}`} draggable={false} className="block h-full w-full" onLoad={(event) => {
          const image = event.currentTarget;
          setDimensions((old) => old?.width === image.naturalWidth && old.height === image.naturalHeight ? old : { width: image.naturalWidth, height: image.naturalHeight });
        }} onError={() => setFailed(true)} />
        {dimensions && <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} aria-hidden="true">
          {rects.map((box, index) => <g key={index}>{["#172019", "#fffdf5"].map((stroke, i) => <rect key={stroke} x={box.x * dimensions.width} y={box.y * dimensions.height} width={box.width * dimensions.width} height={box.height * dimensions.height} fill="none" stroke={stroke} strokeWidth={i ? 2 : 4} vectorEffect="non-scaling-stroke" />)}</g>)}
        </svg>}
      </div>
      {failed && <p role="status" className="p-6">写真を表示できませんでした。閉じて写真を選び直してください。</p>}
    </div>
    <footer className="space-y-2 p-4 text-[13px] leading-[1.8]">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 border border-line-2 px-4" disabled={!dimensions || camera.zoom <= 1} onClick={() => zoomBy(1 / 1.25)}>縮小</button>
        <button type="button" className="min-h-11 border border-line-2 px-4" disabled={!dimensions || camera.zoom >= 6} onClick={() => zoomBy(1.25)}>拡大</button>
        <button type="button" className="min-h-11 px-3 underline underline-offset-4" onClick={reset}>全体を表示</button>
      </div>
      <p>{result?.status === "unavailable" ? "顔の位置を確認できませんでした。写真全体を確かめてください。" : result?.status === "checking" || !result ? "顔の位置を確認中です。" : rects.length ? "枠は顔と判定されたおおよその範囲です。見落としや誤りがあります。" : "顔の候補は検出されませんでした。見落としがあります。"}</p>
      <p className="text-ink-dim">ピンチで拡大・縮小し、拡大後はドラッグで移動できます。確認後は閉じて、フォームの確認欄にチェックしてください。</p>
    </footer>
  </dialog>;
}
