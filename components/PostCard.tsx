"use client";
import { useState } from "react";
import type { TimelinePost } from "@/lib/timeline";

export function PostCard({ post }: { post: TimelinePost }) {
  const [body, setBody] = useState<string | null>(post.veiled ? null : post.body);
  const [reacted, setReacted] = useState(post.reacted);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    const r = await fetch(`/api/posts/${post.id}/reveal`);
    if (r.ok) setBody(((await r.json()) as { body: string }).body);
    setLoading(false);
  }
  async function react() {
    setReacted(!reacted); // 楽観更新
    const r = await fetch(`/api/posts/${post.id}/react`, { method: "POST" });
    if (r.ok) setReacted(((await r.json()) as { reacted: boolean }).reacted);
  }

  return (
    <article className="rounded border border-line bg-card p-3 text-sm">
      <div className="flex gap-2 text-xs text-ink-soft">
        <span>{post.authorName}</span>
        <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString("ja-JP")}</time>
      </div>
      {body === null ? (
        <button onClick={reveal} disabled={loading} className="mt-2 w-full rounded bg-veil px-3 py-4 text-left text-ink-soft">
          伏せています（{post.veiled ? post.reason : ""}）。タップで開く
        </button>
      ) : (
        <p className="mt-2 whitespace-pre-wrap">{body}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
        {post.tags.map((t) => <span key={t}>#{t}</span>)}
        {!post.mine && (
          <button onClick={react} aria-pressed={reacted} className={`ml-auto rounded-full border px-3 py-1 ${reacted ? "border-accent bg-accent text-paper" : "border-line"}`}>
            {reacted ? "届いた" : "届ける"}
          </button>
        )}
      </div>
    </article>
  );
}
