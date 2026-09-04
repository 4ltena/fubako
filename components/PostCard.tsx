"use client";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Blurhash } from "@/components/Blurhash";
import type { Form } from "@/lib/form";
import type { TimelinePost } from "@/lib/timeline";

export function ImageGrid({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (ids.length === 0) return null;
  return (
    <>
      <ul className={`mt-3 grid gap-1 ${ids.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {ids.map((id) => (
          <li key={id}>
            <button type="button" onClick={() => setOpen(id)} className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/images/${id}`} alt="" loading="lazy" className="w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setOpen(null)}
            className="fixed inset-0 z-30 flex items-center justify-center bg-paper/95 p-6"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/${open}`} alt="" className="max-h-full max-w-full object-contain" />
            <button type="button" onClick={() => setOpen(null)} className="label absolute right-6 top-6 border border-line-2 px-4 py-2 text-[11px] text-ink-dim">
              とじる
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * 本文と画像の見せ方。形（lib/form.ts）ごとに分かれるのはここだけで、
 * タイムラインもアーカイブもこれを使う（ページ側に分岐を複製しない）。
 */
export function PostBody({ form, body, imageIds }: { form: Form; body: string; imageIds: string[] }) {
  // 一枚: 画像だけを置き、本文欄は出さない
  if (form === "picture") return <ImageGrid ids={imageIds} />;
  const className = form === "sentence" ? "mt-2 text-[19px] font-medium leading-[1.7]" : "mt-2 whitespace-pre-wrap text-[15px] leading-[1.9]";
  return (
    <>
      <p className={className}>{body}</p>
      <ImageGrid ids={imageIds} />
    </>
  );
}

function Meta({ name, at, stamp, note, trailing }: { name: string; at: string; stamp: string; note?: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-xs text-ink-dim">
      <span className="text-ink">{name}</span>
      {/* 時刻は lib/stamp.ts が JST で作ったものをそのまま出す */}
      <time dateTime={at} className="mono tracking-[0.04em]">{stamp}</time>
      {note && <span className="label text-[11px] text-ink-faint">{note}</span>}
      {trailing}
    </div>
  );
}

export function PostCard({
  post,
  wear = 0,
  preopened = null,
  onVeiled,
}: {
  post: TimelinePost;
  wear?: number;
  preopened?: { body: string; imageIds: string[] } | null;
  onVeiled?: (postId: string) => void;
}) {
  // 開いた本文はサーバから取り直したものだけを持つ。表示は毎回 props から導く。
  const [revealed, setRevealed] = useState<{ body: string; imageIds: string[] } | null>(null);
  const [reacted, setReacted] = useState(post.reacted);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const selfVeiled = post.veiled && post.kind === "self";
  const opened = post.veiled ? (selfVeiled ? null : (revealed ?? preopened)) : { body: post.body, imageIds: post.imageIds };
  const form: Form = post.veiled ? "text" : post.form;
  const similarId = post.veiled ? null : (post.similar?.postId ?? null);
  const tags = post.veiled ? [] : post.tags;

  function goToSimilar() {
    const el = similarId === null ? null : document.getElementById(`post-${similarId}`);
    if (el === null) return;
    const before = window.scrollY;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      if (window.scrollY === before) el.scrollIntoView({ block: "center" });
    }, 400);
  }
  async function reveal() {
    setLoading(true);
    const r = await fetch(`/api/posts/${post.id}/reveal`);
    if (r.ok) setRevealed((await r.json()) as { body: string; imageIds: string[] });
    setLoading(false);
  }
  async function react() {
    setReacted(!reacted);
    const r = await fetch(`/api/posts/${post.id}/react`, { method: "POST" });
    if (r.ok) setReacted(((await r.json()) as { reacted: boolean }).reacted);
  }
  /** この紙を自分のためだけに伏せる。書き手には何も届かない。あとから戻せる。 */
  async function veilForMe() {
    setLoading(true);
    setMenuOpen(false);
    const r = await fetch(`/api/posts/${post.id}/veil`, { method: "POST" });
    if (r.ok) {
      setRevealed(null);
      onVeiled?.(post.id);
      router.refresh();
    }
    setLoading(false);
  }
  async function pullBack() {
    setLoading(true);
    setMenuOpen(false);
    const r = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expireNow: true }),
    });
    if (r.ok) router.refresh();
    setLoading(false);
  }
  async function unveilForMe() {
    setLoading(true);
    setMenuOpen(false);
    const r = await fetch(`/api/posts/${post.id}/veil`, { method: "DELETE" });
    if (r.ok) router.refresh();
    setLoading(false);
  }

  const menu = (
    <span className="relative ml-auto">
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="この紙について"
        aria-expanded={menuOpen}
        className="label flex size-6 items-center justify-center text-sm text-ink-faint"
      >
        …
      </button>
      {menuOpen && (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <span className="absolute right-0 top-7 z-20 block w-max border border-line bg-paper p-2 text-sm">
            {post.mine ? (
              post.returned ? (
                <span className="block w-max px-4 py-3 text-ink-faint">もう他の人からは見えません</span>
              ) : (
                <button type="button" onClick={pullBack} disabled={loading} className="block w-full px-4 py-3 text-left">
                  いま引き取る
                </button>
              )
            ) : post.veiled && post.kind === "self" ? (
              <button type="button" onClick={unveilForMe} disabled={loading} className="block w-full px-4 py-3 text-left">
                伏せたのを戻す
              </button>
            ) : (
              <button type="button" onClick={veilForMe} disabled={loading} className="block w-full px-4 py-3 text-left">
                この紙をしまう
              </button>
            )}
          </span>
        </>
      )}
    </span>
  );

  // 伏せた理由の文言。種類ごとに言い方を変える（書いた人の落ち度にしない）。
  const reasonPrefix = !post.veiled
    ? ""
    : post.kind === "unconfirmed"
      ? "未確認　タグがありません"
      : post.kind === "cw"
        ? "書いた人が先に断っています"
        : post.kind === "self"
          ? "自分で伏せています"
          : "宣言した語と一致しました";
  const reasonWord = post.veiled && (post.kind === "cw" || post.kind === "mute") ? post.reason : "";

  if (opened === null) {
    return (
      <article id={`post-${post.id}`} className="border-b border-line py-4">
        <Meta name={post.authorName} at={post.createdAt} stamp={post.stamp} trailing={post.veiled && post.kind === "unconfirmed" ? undefined : menu} />
        <div className="relative mt-2 overflow-hidden bg-veil" style={{ minHeight: post.images.length > 0 ? 120 : 56 }}>
          {post.images.length > 0 && (
            <div className={`absolute inset-0 grid gap-px ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {post.images.map((img, i) => <Blurhash key={i} hash={img.blurhash} width={img.width} height={img.height} />)}
            </div>
          )}
          <button onClick={reveal} disabled={loading} className="relative flex h-full min-h-[56px] w-full items-center justify-between gap-2.5 px-4 py-3 text-left">
            <span className="label text-[12px] leading-[1.8] text-veil-ink">
              {reasonPrefix}
              {reasonWord && <> <span className="font-bold">{reasonWord}</span></>}
            </span>
            <span className="label shrink-0 text-[12px] text-veil-ink underline underline-offset-4">ひらく</span>
          </button>
        </div>
        {post.veiled && post.kind === "self" && (
          <button onClick={unveilForMe} disabled={loading} className="label mt-2 block text-[11px] text-ink-faint underline underline-offset-4">
            伏せたのを戻す
          </button>
        )}
      </article>
    );
  }

  return (
    <article id={`post-${post.id}`} className="border-b border-line py-4" style={{ opacity: 1 - wear * 0.4 }}>
      <Meta name={post.authorName} at={post.createdAt} stamp={post.stamp} note={post.returned ? "もどってきた" : undefined} trailing={menu} />
      <PostBody form={form} body={opened.body} imageIds={opened.imageIds} />
      {post.veiled && (
        <div className="mt-2 flex items-center gap-2.5">
          <span className="label text-[11px] leading-[1.8] text-ink-faint">
            {post.kind === "cw" ? `書いた人が先に断っています　${post.reason}` : "伏せてあった紙を開いています"}
          </span>
          <button
            type="button"
            onClick={veilForMe}
            disabled={loading}
            className="label ml-auto shrink-0 text-[11px] text-ink-faint underline underline-offset-4"
          >
            また伏せる
          </button>
        </div>
      )}
      {similarId && (
        <button type="button" onClick={goToSimilar} className="label mt-2 block text-[11px] text-ink-faint underline underline-offset-4">
          近いことを書いた人がいます
        </button>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        {tags.map((t) => (
          <span key={t} className="label text-[12px] text-ink-faint">
            <span className="text-ink-faint/70">#</span>{t}
          </span>
        ))}
        {!post.mine && (
          <button
            onClick={react}
            aria-pressed={reacted}
            aria-label={reacted ? "届いた" : "届ける"}
            className={`label ml-auto flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-[12px] ${reacted ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-dim"}`}
          >
            {reacted ? "届いた" : "届ける"}
          </button>
        )}
      </div>
    </article>
  );
}
