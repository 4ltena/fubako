"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PostCard } from "@/components/PostCard";
import type { TimelinePost } from "@/lib/timeline";

/** 新しい紙を見にいく間隔。押し出さないので、短くしない。 */
const LOOK_EVERY_MS = 60_000;

type Opened = { body: string; imageIds: string[] };

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
  const router = useRouter();
  const newest = posts[0]?.createdAt ?? null;

  // 新しい紙が来たかを、画面が前面のときだけ見にいく。件数は聞かないし、
  // 来ていても並びは変えない（読み手が「読みこむ」を押すまで動かさない）。
  useEffect(() => {
    if (newest === null || fresh) return;
    let alive = true;
    const look = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await fetch(`/api/circles/${circleId}/fresh?since=${encodeURIComponent(newest)}`);
      if (!r.ok || !alive) return;
      const { fresh: got } = (await r.json()) as { fresh: boolean };
      if (got && alive) setFresh(true);
    };
    const timer = setInterval(look, LOOK_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [circleId, newest, fresh]);

  const unconfirmed = posts.filter((p) => p.veiled && p.kind === "unconfirmed" && opened[p.id] === undefined);

  async function openUnconfirmed() {
    setBusy(true);
    const got: Record<string, Opened> = {};
    for (const p of unconfirmed) {
      const r = await fetch(`/api/posts/${p.id}/reveal`);
      if (r.ok) got[p.id] = (await r.json()) as Opened;
    }
    setOpened((prev) => ({ ...prev, ...got }));
    setBusy(false);
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
      {fresh && (
        <div className="flex items-center gap-3 rounded-full bg-sage py-3 pl-5 pr-3.5">
          <span className="text-[13px] tracking-[0.06em] text-sage-deep">新しい紙がとどいています</span>
          <button
            type="button"
            onClick={() => {
              setFresh(false);
              router.refresh();
            }}
            className="label ml-auto shrink-0 rounded-full bg-sage-fill px-4 py-[9px] text-[11px] tracking-[0.14em] text-sage-deep"
          >
            読みこむ
          </button>
        </div>
      )}
      {unconfirmed.length > 0 && (
        <button
          onClick={openUnconfirmed}
          disabled={busy}
          className="label w-full rounded-full bg-sage px-5 py-3 text-[11px] tracking-[0.14em] text-sage-deep"
        >
          未確認も開いて見る
        </button>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} wear={wears[p.id] ?? 0} preopened={opened[p.id] ?? null} onVeiled={forget} />
      ))}
    </>
  );
}
