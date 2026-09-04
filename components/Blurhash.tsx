"use client";
import { decode } from "blurhash";
import { useEffect, useRef } from "react";

/** blurhash を 32px 幅の canvas に描き、CSS で引き伸ばす。原画の取得先は持たない。 */
export function Blurhash({ hash, width, height }: { hash: string; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = 32;
  const h = Math.max(1, Math.round((height / width) * w));
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const pixels = decode(hash, w, h);
    const img = ctx.createImageData(w, h);
    img.data.set(pixels);
    ctx.putImageData(img, 0, 0);
  }, [hash, h]);
  return <canvas ref={ref} width={w} height={h} className="h-full w-full object-cover" style={{ aspectRatio: `${width} / ${height}` }} />;
}
