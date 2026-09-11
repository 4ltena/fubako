"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TimelinePost } from "@/lib/timeline";
import { expandGraph, layoutGraph, type GraphEdge } from "@/lib/graph-layout";
import { LetterPaper } from "@/components/LetterPaper";
import { PostCard } from "@/components/PostCard";
import { useGraphGestures } from "@/components/useGraphGestures";
import { MIN_GRAPH_ZOOM, MAX_GRAPH_ZOOM } from "@/lib/graph-camera";

type ReadablePost = Extract<TimelinePost, { veiled: false }>;
export type PaperOrigin = { x: number; y: number; width: number; height: number };
type Phase = "moving" | "settling" | "linking" | "revealing" | "ready";
const CENTER_SCALE = .92;
const titleOf = (post: ReadablePost) => post.body.trim().replace(/\s+/g, " ") || "写真を置いた紙";
const motionStyle = (from: PaperOrigin, size: PaperOrigin): CSSProperties => ({
  width: size.width,
  height: size.height,
  "--start-x": `calc(${from.x + from.width / 2}px - 50vw)`,
  "--start-y": `calc(${from.y + from.height / 2}px - 50dvh)`,
  "--start-scale-x": from.width / size.width,
  "--start-scale-y": from.height / size.height,
  "--center-scale": CENTER_SCALE,
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
  const [center, setCenter] = useState({ id: rootId, from: origin, size: origin });
  const centerButton = useRef<HTMLButtonElement>(null);
  const centerId = center.id;
  // 候補は会員確認済みのTLからのみ受け取る。未実装のpublic箱へ公開範囲を広げない。
  const safe = useMemo(() => posts.filter((post): post is ReadablePost => !post.veiled && !post.returned && Date.parse(post.expiresAt) > now && !!post.related?.length), [posts, now]);
  const root = safe.find((post) => post.id === centerId);
  const [visited, setVisited] = useState(() => expandGraph([], rootId, safe));
  const shown = visited.filter((id) => safe.some((post) => post.id === id));
  const neighbors = safe.filter((post) => shown.includes(post.id) && post.id !== centerId);
  const [phase, setPhase] = useState<Phase>("moving");
  const [size, setSize] = useState({ width: 600, height: 440 });
  const gestures = useGraphGestures(fieldRef, phase === "ready");
  const { zoom, x: panX, y: panY } = gestures.camera;

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
    }, Math.min(2_147_483_647, Math.max(1, next - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [safe]);

  useEffect(() => {
    if (phase === "ready" && centerId !== rootId) centerButton.current?.focus({ preventScroll: true });
  }, [phase, centerId, rootId]);

  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  for (const post of safe) {
    if (!shown.includes(post.id)) continue;
    for (const link of post.id === centerId ? post.related ?? [] : (post.related ?? []).slice(0, 2)) {
      if (!shown.includes(link.postId)) continue;
      const key = [post.id, link.postId].sort().join(":");
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      // 中央に向かう逆向きの情報も、中央から外へ線を描く。
      edges.push(link.postId === centerId
        ? { source: centerId, target: post.id, strength: link.strength }
        : { source: post.id, target: link.postId, strength: link.strength });
    }
  }
  const directEdges = edges.filter((edge) => edge.source === centerId);
  const layout = root ? layoutGraph(shown, centerId, edges) : [];
  const smallWidth = size.width <= 700 ? 118 : 154;
  const smallHeight = size.width <= 700 ? 116 : 132;
  const fit = Math.min(1, Math.max(size.width, size.height) / 1000);
  const peers = layout.filter((point) => point.id !== centerId);
  const compact = peers.length > 6 || size.width < center.size.width + 2 * smallWidth + 160;
  const points = new Map(layout.map((point): [string, { x: number; y: number }] => {
    if (point.id === centerId) return [point.id, { x: size.width / 2, y: size.height / 2 }];
    const radius = Math.hypot(point.x, point.y);
    if (compact) {
      // 横に置けない画面では、中央の原寸を基準に上下の余白へ配置する。
      const index = peers.indexOf(point), topCount = Math.ceil(peers.length / 2);
      const above = index < topCount, offset = above ? index : index - topCount;
      const count = above ? topCount : peers.length - topCount;
      const columns = Math.max(1, Math.floor((size.width - 32) / (smallWidth + 24)));
      const row = Math.floor(offset / columns), rowCount = Math.min(columns, count - row * columns);
      const x = size.width / 2 + (offset % columns - (rowCount - 1) / 2) * (smallWidth + 28);
      const distance = center.size.height / 2 + smallHeight / 2 + 20 + row * (smallHeight + 24) + Math.min(20, Math.max(0, radius - 300) * .25);
      return [point.id, { x, y: size.height / 2 + (above ? -distance : distance) }];
    }
    const dx = point.x / radius, dy = point.y / radius;
    // 原寸の中央便箋と小さな便箋の輪郭が重ならない距離を確保する。
    const paperEdge = Math.min((center.size.width / 2 + smallWidth / 2) / Math.abs(dx), (center.size.height / 2 + smallHeight / 2) / Math.abs(dy));
    const distance = paperEdge + 42 + Math.max(0, radius - 300) * fit;
    const y = size.height / 2 + dy * distance;
    const top = 104 + smallHeight / 2, bottom = size.height - 156 - smallHeight / 2;
    return [point.id, { x: size.width / 2 + dx * distance, y: bottom > top ? Math.max(top, Math.min(bottom, y)) : y }];
  }).map(([id, point]) => [id, { x: size.width / 2 + (point.x - size.width / 2) * zoom + panX, y: size.height / 2 + (point.y - size.height / 2) * zoom + panY }]));

  function explore(id: string, time: number, element?: HTMLElement) {
    if (phase !== "ready") return;
    if (!safe.some((post) => post.id === id && Date.parse(post.expiresAt) > time)) { setNow(() => time); return; }
    const node = fieldRef.current?.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(id)}"]`);
    const rect = (node ?? element)?.getBoundingClientRect();
    const paper = document.getElementById(`post-${id}`)?.querySelector(".letter-paper")?.getBoundingClientRect();
    if (!rect || !paper) return;
    const { x, y, width, height } = rect;
    setCenter({ id, from: { x, y, width, height }, size: { x: paper.x, y: paper.y, width: paper.width, height: paper.height } });
    setVisited((previous) => expandGraph(previous, id, safe));
    gestures.reset();
    setPhase("moving");
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={headingId} className="related-graph" data-phase={phase} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="related-graph__shell">
        <header className="related-graph__header">
          <div><h2 id={headingId}>言葉のつながり</h2><p>小さな便箋でつながりをたどり、中央の便箋をもう一度選ぶとTLへ戻ります。</p></div>
          <button type="button" onClick={onClose} autoFocus>とじる</button>
        </header>
        <div ref={fieldRef} className="related-graph__field" {...gestures.events}>
          <svg width="100%" height="100%" aria-hidden="true" className="related-graph__lines">
            {edges.map((edge) => {
              const from = points.get(edge.source), to = points.get(edge.target);
              return from && to ? <line key={`${edge.source}:${edge.target}`} className={edge.source === centerId ? "related-graph__ray" : "related-graph__crosslink"} pathLength="1" x1={from.x} y1={from.y} x2={to.x} y2={to.y} strokeWidth={.8 + edge.strength * 2.2} strokeOpacity={.3 + edge.strength * .45} onAnimationEnd={(event) => {
                if (event.animationName === "graph-line-in" && edge === directEdges.at(-1)) setPhase("revealing");
              }} /> : null;
            })}
          </svg>
          {neighbors.map((post, index) => {
            const position = points.get(post.id);
            return position && <button key={post.id} type="button" data-post-id={post.id} className="related-graph__node" style={{ left: position.x, top: position.y, transform: `translate(-50%, -50%) scale(${zoom})` }} disabled={phase !== "ready"} aria-label={`${post.authorName}の紙からつながりをたどる：${titleOf(post)}`} onClick={(event) => explore(post.id, Date.now(), event.currentTarget)} onAnimationEnd={(event) => {
              if (event.animationName === "graph-paper-in" && index === neighbors.length - 1) setPhase("ready");
            }}>
              <LetterPaper as="span" createdAt={post.createdAt}>
                <span className="related-graph__paper-author">{post.authorName}</span>
                <span className="related-graph__paper-text">{titleOf(post)}</span>
                <span className="related-graph__paper-date">{post.stamp}</span>
              </LetterPaper>
            </button>;
          })}
          {root ? <section key={centerId} className="related-graph__center" aria-label={`${root.authorName}の紙：${titleOf(root)}`} style={{ ...motionStyle(center.from, center.size), left: `calc(50% + ${panX}px)`, top: `calc(50% + ${panY}px)`, transform: phase === "moving" || phase === "settling" ? undefined : `translate(-50%, -50%) scale(${zoom * CENTER_SCALE})` }} onAnimationEnd={(event) => {
            if (event.animationName === "graph-center-in") setPhase("settling");
            if (event.animationName === "graph-center-settle") setPhase(directEdges.length ? "linking" : "ready");
          }}>
            <PostCard post={root} presentation />
            <button ref={centerButton} type="button" className="related-graph__center-open" disabled={phase !== "ready"} aria-label={`${root.authorName}の紙と前後の投稿をTLで読む`} onClick={() => {
              const time = Date.now();
              if (Date.parse(root.expiresAt) > time) onGoToPost(root.id);
              else setNow(time);
            }}><span className="sr-only">中央の便箋をもう一度選ぶとTLへ戻ります</span></button>
          </section> : <p className="related-graph__empty" role="status">今ここで読める関連の紙がありません。箱を読み込み直してください。</p>}

        </div>
        <footer className="related-graph__footer">
          <div className="related-graph__toolbar" aria-label="グラフの表示">
            <button type="button" aria-label="グラフを縮小" disabled={phase !== "ready" || zoom <= MIN_GRAPH_ZOOM} onClick={() => gestures.zoomBy(1 / 1.25)}>−</button>
            <button type="button" aria-label="グラフを拡大" disabled={phase !== "ready" || zoom >= MAX_GRAPH_ZOOM} onClick={() => gestures.zoomBy(1.25)}>＋</button>
            <button type="button" disabled={phase !== "ready"} onClick={gestures.reset}>中心へ戻す</button>
          </div>
          <p className="related-graph__legend">線が強く、近いほど共通する言葉があります。ドラッグで移動、ピンチで拡大・縮小できます。</p>
          <details className="related-graph__list">
            <summary>紙の一覧から選ぶ</summary>
            <div>{neighbors.map((post) => <button key={post.id} type="button" disabled={phase !== "ready"} onClick={(event) => explore(post.id, Date.now(), event.currentTarget)}>{post.authorName}：{titleOf(post)}</button>)}</div>
          </details>
        </footer>
      </div>
    </dialog>
  );
}
