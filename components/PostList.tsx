"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/PostCard";
import { RelatedPostGraph } from "@/components/RelatedPostGraph";
import type { TimelinePost } from "@/lib/timeline";

/** 新しい紙を見にいく間隔。押し出さないので、短くしない。 */
const LOOK_EVERY_MS = 60_000;

type Opened = { body: string; imageIds: string[]; imageGrant?: string };

/**
 * タイムラインの紙の並び。
 *
 * 「未確認も開いて見る」は、いま並んでいる紙のうちタグが無いだけのものを、
 * 読み手が自分で一度に開く操作。設定として残らないので、これから届く紙は伏せたまま。
 * 開き方は1枚ずつ「ひらく」を押すのと同じ（/api/posts/:id/reveal を叩く）。
 */
export function PostList({ posts, wears, circleId }: { posts: TimelinePost[]; wears: Record<string, number>; circleId: string }) {
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState("");
  const [graphRoot, setGraphRoot] = useState<string | null>(null);
  const opening = useRef(false);
  const router = useRouter();
  // 1枚も無い箱でも、開いたときから後に置かれた紙は拾う
  const [openedAt] = useState(() => new Date().toISOString());
  const newest = posts[0]?.createdAt ?? openedAt;

  // 新しい紙が来たかを、画面が前面のときだけ見にいく。件数は聞かないし、
  // 来ていても並びは変えない（読み手が「読みこむ」を押すまで動かさない）。
  useEffect(() => {
    if (fresh) return;
    let alive = true;
    const look = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/circles/${circleId}/fresh?since=${encodeURIComponent(newest)}`);
        if (!r.ok || !alive) return;
        const { fresh: got } = (await r.json()) as { fresh: boolean };
        if (got && alive) setFresh(true);
      } catch { /* 新着確認は次の周期で再試行する。 */ }
    };
    const timer = setInterval(look, LOOK_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [circleId, newest, fresh]);

  const unconfirmed = posts.filter((p) => p.veiled && p.kind === "unconfirmed" && opened[p.id] === undefined);

  async function openUnconfirmed() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError("");
    const got: Record<string, Opened> = {};
    let failed = false;
    try {
      for (const p of unconfirmed) {
        try {
          const r = await fetch(`/api/posts/${p.id}/reveal`);
          if (r.ok) got[p.id] = (await r.json()) as Opened;
          else failed = true;
        } catch { failed = true; }
      }
    } finally {
      setOpened((prev) => ({ ...prev, ...got }));
      if (failed) setError("ひらけなかった紙があります。もう一度試してください。");
      opening.current = false;
      setBusy(false);
    }
  }

  /** 伏せ直した紙は、まとめて開いたときの本文も捨てる。 */
  function forget(postId: string) {
    setOpened((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
  }

  return (
    <>
      {posts.some((post) => !post.mine) && (
        <p className="label border-b border-line py-3 text-[12px] leading-[1.9] text-ink-dim">
          「書いた人に届ける」は、この紙への反応です。書いた人の「じぶんの箱」に「届いています」と表示されます。名前や人数は表示されません。
        </p>
      )}
      {fresh && (
        <div className="flex items-center gap-3 border-b border-line py-3">
          <span className="label text-[12px] text-ink-dim">新しい紙がとどいています</span>
          <button
            type="button"
            onClick={() => {
              setFresh(false);
              router.refresh();
            }}
            className="label ml-auto flex min-h-11 shrink-0 items-center px-1 text-[12px] text-ink-dim underline underline-offset-4"
          >
            読みこむ
          </button>
        </div>
      )}
      {unconfirmed.length > 0 && (
        <button
          onClick={openUnconfirmed}
          disabled={busy}
          className="label min-h-11 w-full border-b border-line py-3 text-[12px] text-ink-dim underline underline-offset-4"
        >
          未確認も開いて見る
        </button>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} wear={wears[p.id] ?? 0} preopened={opened[p.id] ?? null} onVeiled={forget} onClosed={forget} onExplore={setGraphRoot} />
      ))}
      {graphRoot && <RelatedPostGraph key={graphRoot} rootId={graphRoot} posts={posts} onClose={() => setGraphRoot(null)} onGoToPost={(id) => {
        setGraphRoot(null);
        requestAnimationFrame(() => {
          const paper = document.getElementById(`post-${id}`);
          paper?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
          paper?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
        });
      }} />}
      {error && <p role="alert" className="label py-3 text-[12px] text-ink-dim">{error}</p>}
    </>
  );
}
