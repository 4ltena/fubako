"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TimelinePost } from "@/lib/timeline";
import { expandGraph, layoutGraph, type GraphEdge } from "@/lib/graph-layout";
import { LetterPaper } from "@/components/LetterPaper";
import { PostCard } from "@/components/PostCard";

type ReadablePost = Extract<TimelinePost, { veiled: false }>;
export type PaperOrigin = { x: number; y: number; width: number; height: number };
type Phase = "moving" | "linking" | "revealing" | "ready";
const titleOf = (post: ReadablePost) => post.body.trim().replace(/\s+/g, " ") || "写真を置いた紙";
const motionStyle = (from: PaperOrigin, size: PaperOrigin): CSSProperties => ({
  width: size.width,
  height: size.height,
  "--start-x": `calc(${from.x + from.width / 2}px - 50vw)`,
  "--start-y": `calc(${from.y + from.height / 2}px - 50dvh)`,
  "--start-scale-x": from.width / size.width,
  "--start-scale-y": from.height / size.height,
} as CSSProperties);

export function RelatedPostGraph({ posts, rootId, origin, onClose, onGoToPost }: {
  posts: TimelinePost[];
  rootId: string;
  origin: PaperOrigin;
  onClose: () => void;
  onGoToPost: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const [now, setNow] = useState(() => Date.now());
  // 候補は会員確認済みのTLからのみ受け取る。未実装のpublic箱へ公開範囲を広げない。
  const safe = useMemo(() => posts.filter((post): post is ReadablePost => !post.veiled && !post.returned && Date.parse(post.expiresAt) > now && !!post.related?.length), [posts, now]);
  const root = safe.find((post) => post.id === rootId);
  const shown = expandGraph([], rootId, safe);
  const neighbors = safe.filter((post) => shown.includes(post.id) && post.id !== rootId);
  const [phase, setPhase] = useState<Phase>("moving");
  const [departure, setDeparture] = useState<{ id: string; from: PaperOrigin } | null>(null);
  const departingPost = safe.find((post) => post.id === departure?.id);
  const [size, setSize] = useState({ width: 600, height: 440 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const field = fieldRef.current!;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(field);
    return () => {
      observer.disconnect();
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const next = Math.min(...safe.map((post) => Date.parse(post.expiresAt)));
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => {
      const time = Date.now();
      setNow(time);
      setDeparture((value) => value && safe.some((post) => post.id === value.id && Date.parse(post.expiresAt) > time) ? value : null);
    }, Math.min(2_147_483_647, Math.max(1, next - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [safe]);

  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  for (const post of safe) {
    if (!shown.includes(post.id)) continue;
    for (const link of post.related ?? []) {
      if (!shown.includes(link.postId)) continue;
      const key = [post.id, link.postId].sort().join(":");
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      // 中央に向かう逆向きの情報も、中央から外へ線を描く。
      edges.push(link.postId === rootId
        ? { source: rootId, target: post.id, strength: link.strength }
        : { source: post.id, target: link.postId, strength: link.strength });
    }
  }
  const directEdges = edges.filter((edge) => edge.source === rootId);
  const layout = root ? layoutGraph(shown, rootId, edges) : [];
  const smallWidth = size.width <= 700 ? 118 : 154;
  const smallHeight = size.width <= 700 ? 116 : 132;
  const fit = Math.min(1, Math.max(size.width, size.height) / 1000);
  const peers = layout.filter((point) => point.id !== rootId);
  const compact = size.width < origin.width + 2 * smallWidth + 160;
  const points = new Map(layout.map((point) => {
    if (point.id === rootId) return [point.id, { x: size.width / 2 + pan.x, y: size.height / 2 + pan.y }];
    const radius = Math.hypot(point.x, point.y);
    if (compact) {
      // 横に置けない画面では中央を縮めず、上下の余白へ配置する。
      const index = peers.indexOf(point), topCount = Math.ceil(peers.length / 2);
      const above = index < topCount, offset = above ? index : index - topCount;
      const count = above ? topCount : peers.length - topCount;
      const columns = Math.max(1, Math.floor((size.width - 32) / (smallWidth + 24)));
      const row = Math.floor(offset / columns), rowCount = Math.min(columns, count - row * columns);
      const x = size.width / 2 + (offset % columns - (rowCount - 1) / 2) * (smallWidth + 28) * zoom;
      const distance = origin.height / 2 + smallHeight / 2 + 20 + row * (smallHeight + 24) + Math.max(0, radius - 300) * .25 * zoom;
      return [point.id, { x: x + pan.x, y: size.height / 2 + (above ? -distance : distance) + pan.y }];
    }
    const dx = point.x / radius, dy = point.y / radius;
    // 原寸の中央便箋と小さな便箋の輪郭が重ならない距離を確保する。
    const paperEdge = Math.min((origin.width / 2 + smallWidth / 2) / Math.abs(dx), (origin.height / 2 + smallHeight / 2) / Math.abs(dy));
    const distance = paperEdge + 42 + Math.max(0, radius - 300) * fit * zoom;
    const y = size.height / 2 + dy * distance;
    const top = 104 + smallHeight / 2, bottom = size.height - 156 - smallHeight / 2;
    return [point.id, { x: size.width / 2 + dx * distance + pan.x, y: (bottom > top ? Math.max(top, Math.min(bottom, y)) : y) + pan.y }];
  }));

  function openTimeline(id: string, time: number, element?: HTMLElement) {
    if (phase !== "ready" || departure) return;
    if (!safe.some((post) => post.id === id && Date.parse(post.expiresAt) > time)) { setNow(() => time); return; }
    const node = fieldRef.current?.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(id)}"]`);
    const rect = (node ?? element)?.getBoundingClientRect();
    if (!rect) return;
    const { x, y, width, height } = rect;
    setDeparture({ id, from: { x, y, width, height } });
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={headingId} className="related-graph" data-phase={phase} data-departing={!!departure} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="related-graph__shell">
        <header className="related-graph__header">
          <div><h2 id={headingId}>言葉のつながり</h2><p>小さな便箋を選ぶと、前後の紙と一緒に読めます。</p></div>
          <button type="button" onClick={onClose} autoFocus>とじる</button>
        </header>
        <div ref={fieldRef} className="related-graph__field" onPointerDown={(event) => {
          if (phase !== "ready" || departure || (event.target as Element).closest("button, .related-graph__center") || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
        }} onPointerMove={(event) => {
          if (drag.current) setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y });
        }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          <svg width="100%" height="100%" aria-hidden="true" className="related-graph__lines">
            {edges.map((edge) => {
              const from = points.get(edge.source), to = points.get(edge.target);
              return from && to ? <line key={`${edge.source}:${edge.target}`} className={edge.source === rootId ? "related-graph__ray" : "related-graph__crosslink"} pathLength="1" x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={.8 + edge.strength * 2.2} strokeOpacity={.3 + edge.strength * .45} onAnimationEnd={(event) => {
                if (event.animationName === "graph-line-in" && edge === directEdges.at(-1)) setPhase("revealing");
              }} /> : null;
            })}
          </svg>
          {neighbors.map((post, index) => {
            const position = points.get(post.id);
            return position && <button key={post.id} type="button" data-post-id={post.id} className="related-graph__node" style={{ left: position.x, top: position.y, visibility: departure?.id === post.id ? "hidden" : undefined }} disabled={phase !== "ready" || !!departure} aria-label={`${post.authorName}の紙をTLで読む：${titleOf(post)}`} onClick={(event) => openTimeline(post.id, Date.now(), event.currentTarget)} onAnimationEnd={(event) => {
              if (event.animationName === "graph-paper-in" && index === neighbors.length - 1) setPhase("ready");
            }}>
              <LetterPaper as="span" createdAt={post.createdAt}>
                <span className="related-graph__paper-author">{post.authorName}</span>
                <span className="related-graph__paper-text">{titleOf(post)}</span>
                <span className="related-graph__paper-date">{post.stamp}</span>
              </LetterPaper>
            </button>;
          })}
          {root ? <section className="related-graph__center" aria-label={`${root.authorName}の紙：${titleOf(root)}`} style={{ ...motionStyle(origin, origin), left: `calc(50% + ${pan.x}px)`, top: `calc(50% + ${pan.y}px)` }} onAnimationEnd={(event) => {
            if (event.animationName === "graph-center-in") setPhase(directEdges.length ? "linking" : "ready");
          }}>
            <PostCard post={root} presentation />
          </section> : <p className="related-graph__empty" role="status">今ここで読める関連の紙がありません。箱を読み込み直してください。</p>}
          {departure && departingPost && <section className="related-graph__departure" aria-label={`${departingPost.authorName}の紙を開いています`} style={motionStyle(departure.from, origin)} onAnimationEnd={(event) => {
            if (event.animationName !== "graph-center-in") return;
            // 拡大中に期限が切れた投稿へは遷移しない。
            if (Date.parse(departingPost.expiresAt) > Date.now()) onGoToPost(departingPost.id);
            else { setDeparture(null); setNow(Date.now()); }
          }}><PostCard post={departingPost} presentation /></section>}
        </div>
        <footer className="related-graph__footer">
          <div className="related-graph__toolbar" aria-label="グラフの表示">
            <button type="button" aria-label="グラフを縮小" disabled={phase !== "ready" || !!departure || zoom <= .6} onClick={() => setZoom((value) => Math.max(.6, value - .25))}>−</button>
            <button type="button" aria-label="グラフを拡大" disabled={phase !== "ready" || !!departure || zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + .25))}>＋</button>
            <button type="button" disabled={phase !== "ready" || !!departure} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>中心へ戻す</button>
          </div>
          <p className="related-graph__legend">線が強く、近いほど共通する言葉があります。余白をドラッグして移動できます。</p>
          <details className="related-graph__list">
            <summary>紙の一覧から選ぶ</summary>
            <div>{neighbors.map((post) => <button key={post.id} type="button" disabled={phase !== "ready" || !!departure} onClick={(event) => openTimeline(post.id, Date.now(), event.currentTarget)}>{post.authorName}：{titleOf(post)}</button>)}</div>
          </details>
        </footer>
      </div>
    </dialog>
  );
}
