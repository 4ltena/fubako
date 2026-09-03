"use client";
import { useState } from "react";
import { PostCard } from "@/components/PostCard";
import type { TimelinePost } from "@/lib/timeline";

type Opened = { body: string; imageIds: string[] };

/**
 * タイムラインの紙の並び。
 *
 * 「未確認も開いて見る」は、いま並んでいる紙のうちタグが無いだけのものを、
 * 読み手が自分で一度に開く操作。設定として残らないので、これから届く紙は伏せたまま。
 * 開き方は1枚ずつ「ひらく」を押すのと同じ（/api/posts/:id/reveal を叩く）。
 */
export function PostList({ posts, wears }: { posts: TimelinePost[]; wears: Record<string, number> }) {
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const [busy, setBusy] = useState(false);

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

  return (
    <>
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
        <PostCard key={p.id} post={p} wear={wears[p.id] ?? 0} preopened={opened[p.id] ?? null} />
      ))}
    </>
  );
}
