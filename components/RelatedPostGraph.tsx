"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { TimelinePost } from "@/lib/timeline";
import { expandGraph, GRAPH_LIMIT, layoutGraph, type GraphEdge } from "@/lib/graph-layout";
import { LetterPaper } from "@/components/LetterPaper";
import { PostBody } from "@/components/PostCard";

type ReadablePost = Extract<TimelinePost, { veiled: false }>;
const titleOf = (post: ReadablePost) => post.body.trim().replace(/\s+/g, " ") || "写真を置いた紙";

export function RelatedPostGraph({ posts, rootId, onClose, onGoToPost }: {
  posts: TimelinePost[];
  rootId: string;
  onClose: () => void;
  onGoToPost: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState(rootId);
  const safe = useMemo(() => posts.filter((post): post is ReadablePost => !post.veiled && !post.returned && Date.parse(post.expiresAt) > now && !!post.related?.length), [posts, now]);
  const safeIds = useMemo(() => new Set(safe.map((post) => post.id)), [safe]);
  const [visited, setVisited] = useState(() => expandGraph([], rootId, safe));
  const selected = safe.find((post) => post.id === selectedId) ?? safe.find((post) => post.id === rootId) ?? safe.find((post) => visited.includes(post.id));
  const shown = visited.filter((id) => safeIds.has(id));
  const [size, setSize] = useState({ width: 600, height: 440 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const next = Math.min(...safe.map((post) => Date.parse(post.expiresAt)));
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(1, next - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [safe]);

  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  for (const post of safe) {
    if (!shown.includes(post.id)) continue;
    for (const link of post.related ?? []) {
      if (!shown.includes(link.postId) || !safeIds.has(link.postId)) continue;
      const key = [post.id, link.postId].sort().join(":");
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ source: post.id, target: link.postId, strength: link.strength });
    }
  }
  const layout = selected ? layoutGraph(shown, selected.id, edges) : [];
  const extentX = Math.max(160, ...layout.map((p) => Math.abs(p.x)));
  const extentY = Math.max(140, ...layout.map((p) => Math.abs(p.y)));
  const fit = Math.max(.38, Math.min(1, Math.max(100, size.width - 180) / (2 * extentX), Math.max(100, size.height - 140) / (2 * extentY)));
  const points = new Map(layout.map((point) => [point.id, { x: size.width / 2 + point.x * fit * zoom + pan.x, y: size.height / 2 + point.y * fit * zoom + pan.y }]));

  function select(id: string) {
    const current = safe.filter((post) => Date.parse(post.expiresAt) > Date.now());
    if (!current.some((post) => post.id === id)) { setNow(() => Date.now()); return; }
    setVisited((previous) => expandGraph(previous, id, current));
    setSelectedId(id);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={headingId} className="related-graph" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="related-graph__shell">
        <header className="related-graph__header">
          <div><h2 id={headingId}>言葉のつながり</h2><p>便箋を選ぶと、その紙からつながりが広がります。</p></div>
          <button type="button" onClick={onClose} autoFocus>とじる</button>
        </header>
        <div className="related-graph__content">
          <div className="related-graph__map">
            <div className="related-graph__toolbar" aria-label="グラフの表示">
              <button type="button" aria-label="グラフを縮小" disabled={zoom <= .6} onClick={() => setZoom((value) => Math.max(.6, value - .25))}>−</button>
              <button type="button" aria-label="グラフを拡大" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + .25))}>＋</button>
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>中心へ戻す</button>
            </div>
            <div ref={fieldRef} className="related-graph__field" onPointerDown={(event) => {
              if ((event.target as Element).closest("button") || event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
            }} onPointerMove={(event) => {
              if (drag.current) setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y });
            }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
              <svg width="100%" height="100%" aria-hidden="true" className="related-graph__lines">
                {edges.map((edge) => {
                  const from = points.get(edge.source), to = points.get(edge.target);
                  return from && to ? <line key={`${edge.source}:${edge.target}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={.8 + edge.strength * 2.2} strokeOpacity={.3 + edge.strength * .45} /> : null;
                })}
              </svg>
              {layout.map((point) => {
                const post = safe.find((p) => p.id === point.id)!;
                const position = points.get(point.id)!;
                const isSelected = selected?.id === point.id;
                return <button key={point.id} type="button" className="related-graph__node" style={{ left: position.x, top: position.y }} aria-label={`${post.authorName}の紙：${titleOf(post)}`} aria-pressed={isSelected} onClick={() => select(point.id)}>
                  <LetterPaper as="span" createdAt={post.createdAt}>
                    <span className="related-graph__paper-author">{post.authorName}</span>
                    <span className="related-graph__paper-text">{titleOf(post)}</span>
                    <span className="related-graph__paper-date">{isSelected ? "読んでいる紙" : post.stamp}</span>
                  </LetterPaper>
                </button>;
              })}
            </div>
            <p className="related-graph__legend">線が強く、近いほど共通する言葉があります。余白をドラッグして移動できます。</p>
            {shown.length >= GRAPH_LIMIT && <p role="status" className="related-graph__legend">一度に広げられる範囲まで表示しています。</p>}
          </div>
          <aside className="related-graph__reading" aria-label="選んだ紙">
            {selected ? <>
              <div aria-live="polite" aria-atomic="true" className="related-graph__byline">{selected.authorName}<time dateTime={selected.createdAt}>{selected.stamp}</time></div>
              <LetterPaper createdAt={selected.createdAt}><PostBody form={selected.form} body={selected.body} imageIds={selected.imageIds} /></LetterPaper>
              <button type="button" className="related-graph__go" onClick={() => onGoToPost(selected.id)}>この紙へ移動する</button>
            </> : <p role="status">今ここで読める関連の紙がありません。箱を読み込み直してください。</p>}
          </aside>
        </div>
        <details className="related-graph__list">
          <summary>紙の一覧から選ぶ</summary>
          <div>{safe.filter((post) => shown.includes(post.id)).map((post) => <button key={post.id} type="button" aria-pressed={selected?.id === post.id} onClick={() => select(post.id)}>{post.authorName}：{titleOf(post)}</button>)}</div>
        </details>
      </div>
    </dialog>
  );
}
