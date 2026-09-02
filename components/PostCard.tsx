"use client";
import { useState } from "react";
import { Blurhash } from "@/components/Blurhash";
import type { TimelinePost } from "@/lib/timeline";

export function ImageGrid({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <ul className={`mt-2 grid gap-2 ${ids.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {ids.map((id) => (
        <li key={id}>
          <a href={`/api/images/${id}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/${id}`} alt="" loading="lazy" className="w-full rounded object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function PostCard({ post }: { post: TimelinePost }) {
  const [opened, setOpened] = useState<{ body: string; imageIds: string[] } | null>(post.veiled ? null : { body: post.body, imageIds: post.imageIds });
  const [reacted, setReacted] = useState(post.reacted);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    const r = await fetch(`/api/posts/${post.id}/reveal`);
    if (r.ok) setOpened((await r.json()) as { body: string; imageIds: string[] });
    setLoading(false);
  }
  async function react() {
    setReacted(!reacted);
    const r = await fetch(`/api/posts/${post.id}/react`, { method: "POST" });
    if (r.ok) setReacted(((await r.json()) as { reacted: boolean }).reacted);
  }

  return (
    <article className="rounded border border-line bg-card p-3 text-sm">
      <div className="flex gap-2 text-xs text-ink-soft">
        <span>{post.authorName}</span>
        <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString("ja-JP")}</time>
      </div>
      {opened === null ? (
        <button onClick={reveal} disabled={loading} className="relative mt-2 w-full overflow-hidden rounded bg-veil text-left text-ink-soft">
          {post.images.length > 0 && (
            <div className={`grid gap-1 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {post.images.map((img, i) => <Blurhash key={i} hash={img.blurhash} width={img.width} height={img.height} />)}
            </div>
          )}
          <span className="block px-3 py-4">伏せています（{post.veiled ? post.reason : ""}）。タップで開く</span>
        </button>
      ) : (
        <>
          <p className="mt-2 whitespace-pre-wrap">{opened.body}</p>
          <ImageGrid ids={opened.imageIds} />
        </>
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
