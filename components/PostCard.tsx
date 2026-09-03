"use client";
import { useState } from "react";
import { Blurhash } from "@/components/Blurhash";
import type { Form } from "@/lib/form";
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

/**
 * 本文と画像の見せ方。形（lib/form.ts）ごとに分かれるのはここだけで、
 * タイムラインもアーカイブもこれを使う（ページ側に分岐を複製しない）。
 */
export function PostBody({ form, body, imageIds }: { form: Form; body: string; imageIds: string[] }) {
  // 一枚: 画像だけを置き、本文欄は出さない
  if (form === "picture") return <ImageGrid ids={imageIds} />;
  const className =
    form === "sentence"
      ? "mt-2 text-lg" // 一文: やや大きく1行で
      : form === "verse"
        ? "mt-2 whitespace-pre-wrap text-center leading-loose" // 一句: 中央揃え・行間広め
        : "mt-2 whitespace-pre-wrap";
  return (
    <>
      <p className={className}>{body}</p>
      <ImageGrid ids={imageIds} />
    </>
  );
}

export function PostCard({ post }: { post: TimelinePost }) {
  const [opened, setOpened] = useState<{ body: string; imageIds: string[] } | null>(post.veiled ? null : { body: post.body, imageIds: post.imageIds });
  // 伏せた投稿は form を持たない。開いたあとも形は使わず通常表示にする。
  const form: Form = post.veiled ? "text" : post.form;
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
        <PostBody form={form} body={opened.body} imageIds={opened.imageIds} />
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
