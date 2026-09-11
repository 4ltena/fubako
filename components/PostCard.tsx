"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Blurhash } from "@/components/Blurhash";
import { LetterPaper } from "@/components/LetterPaper";
import type { Form } from "@/lib/form";
import type { TimelinePost } from "@/lib/timeline";

export function ImageGrid({ ids, imageGrant }: { ids: string[]; imageGrant?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  if (ids.length === 0) return null;
  return (
    <>
      <ul className={`mt-3 grid gap-1 ${ids.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {ids.map((id) => (
          <li key={id}>
            <button type="button" onClick={() => setOpen(id)} aria-label="写真を大きく見る" className="block min-h-11 w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/images/${id}${imageGrant ? `?grant=${encodeURIComponent(imageGrant)}` : ""}`} alt="" loading="lazy" className="w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <dialog ref={dialogRef} aria-label="写真を大きく表示" onCancel={(event) => { event.preventDefault(); setOpen(null); }} onClick={(event) => { if (event.target === event.currentTarget) setOpen(null); }} className="m-auto max-h-full max-w-full border-0 bg-paper/95 p-6 backdrop:bg-ink/20">
          {open && <div className="relative flex max-h-[calc(100vh-3rem)] max-w-[calc(100vw-3rem)] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/${open}${imageGrant ? `?grant=${encodeURIComponent(imageGrant)}` : ""}`} alt="" className="max-h-full max-w-full object-contain" />
            <button type="button" onClick={() => setOpen(null)} className="label absolute right-0 top-0 flex min-h-11 min-w-11 items-center justify-center border border-line-2 px-4 text-[12px] text-ink-dim">
              とじる
            </button>
          </div>}
      </dialog>
    </>
  );
}

/**
 * 本文と画像の見せ方。形（lib/form.ts）ごとに分かれるのはここだけで、
 * タイムラインもアーカイブもこれを使う（ページ側に分岐を複製しない）。
 */
export function PostBody({ form, body, imageIds, imageGrant }: { form: Form; body: string; imageIds: string[]; imageGrant?: string }) {
  // 一枚: 画像だけを置き、本文欄は出さない
  if (form === "picture") return <ImageGrid ids={imageIds} imageGrant={imageGrant} />;
  const className = `letter-body mt-2 whitespace-pre-wrap ${form === "sentence" ? "letter-body--sentence font-medium" : form === "verse" ? "letter-body--verse" : ""}`;
  return (
    <>
      <p className={className}>{body}</p>
      <ImageGrid ids={imageIds} imageGrant={imageGrant} />
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
  preopened = null,
  onVeiled,
  onClosed,
  onExplore,
  presentation = false,
}: {
  post: TimelinePost;
  wear?: number;
  preopened?: { body: string; imageIds: string[]; imageGrant?: string } | null;
  onVeiled?: (postId: string) => void;
  onClosed?: (postId: string) => void;
  onExplore?: (postId: string) => void;
  /** グラフの移動演出では同じ便箋を表示するが、投稿操作はTLで行う。 */
  presentation?: boolean;
}) {
  // 開いた本文はサーバから取り直したものだけを持つ。一時的に閉じても保存状態は変えない。
  const [revealed, setRevealed] = useState<{ body: string; imageIds: string[]; imageGrant?: string } | null>(null);
  const [reacted, setReacted] = useState(post.reacted);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const opened = post.veiled ? (revealed ?? preopened) : { body: post.body, imageIds: post.imageIds };
  const form: Form = post.veiled ? "text" : post.form;
  const similarId = post.veiled ? null : (post.similar?.postId ?? null);
  const tags = post.veiled ? [] : post.tags;

  function goToSimilar() {
    if (onExplore) { onExplore(post.id); return; }
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
    setError(null);
    try {
      const r = await fetch(`/api/posts/${post.id}/reveal`);
      if (r.ok) setRevealed((await r.json()) as { body: string; imageIds: string[]; imageGrant?: string });
      else setError("ひらけませんでした。もう一度試してください。");
    } catch { setError("通信できませんでした。もう一度試してください。"); }
    finally { setLoading(false); }
  }
  async function react() {
    if (loading) return;
    setLoading(true);
    setReacted(!reacted);
    try {
      const r = await fetch(`/api/posts/${post.id}/react`, { method: "POST" });
      if (r.ok) setReacted(((await r.json()) as { reacted: boolean }).reacted);
      else setReacted(post.reacted);
    } catch { setReacted(post.reacted); }
    finally { setLoading(false); }
  }
  /** この紙を自分のためだけに伏せる。書き手には何も届かない。あとから戻せる。 */
  async function veilForMe() {
    setLoading(true);
    setMenuOpen(false);
    setError(null);
    try {
      const r = await fetch(`/api/posts/${post.id}/veil`, { method: "POST" });
      if (r.ok) { setRevealed(null); onVeiled?.(post.id); router.refresh(); }
      else setError("伏せられませんでした。もう一度試してください。");
    } catch { setError("通信できませんでした。もう一度試してください。"); }
    finally { setLoading(false); }
  }
  async function pullBack() {
    setLoading(true);
    setMenuOpen(false);
    setError(null);
    try {
      const r = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expireNow: true }),
      });
      if (r.ok) router.refresh(); else setError("公開を終えられませんでした。もう一度試してください。");
    } catch { setError("通信できませんでした。もう一度試してください。"); }
    finally { setLoading(false); }
  }
  async function unveilForMe() {
    setLoading(true);
    setMenuOpen(false);
    setError(null);
    try {
      const r = await fetch(`/api/posts/${post.id}/veil`, { method: "DELETE" });
      if (r.ok) router.refresh(); else setError("伏せを解除できませんでした。もう一度試してください。");
    } catch { setError("通信できませんでした。もう一度試してください。"); }
    finally { setLoading(false); }
  }

  const menu = (
    <span className="relative ml-auto">
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="この紙について"
        aria-expanded={menuOpen}
        className="label flex size-11 items-center justify-center text-sm text-ink-faint"
      >
        …
      </button>
      {menuOpen && (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <span className="absolute right-0 top-11 z-20 block w-max border border-line bg-paper p-2 text-sm">
            {post.mine ? (
              post.returned ? (
                <span className="block w-max px-4 py-3 text-ink-faint">もう他の人からは見えません</span>
              ) : (
                <button type="button" onClick={pullBack} disabled={loading} className="block min-h-11 w-full px-4 py-3 text-left">
                  公開を終える
                </button>
              )
            ) : post.veiled && post.kind === "self" ? (
              <button type="button" onClick={unveilForMe} disabled={loading} className="block min-h-11 w-full px-4 py-3 text-left">
                自分の伏せを解除
              </button>
            ) : (
              <button type="button" onClick={veilForMe} disabled={loading} className="block min-h-11 w-full px-4 py-3 text-left">
                この紙を自分だけ伏せる
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
          : "避けている語と一致しました";
  const reasonWord = post.veiled && (post.kind === "cw" || post.kind === "mute") ? post.reason : "";

  if (opened === null) {
    return (
      <article id={`post-${post.id}`} className="border-b border-line py-4">
        <LetterPaper createdAt={post.createdAt}>
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
          <button onClick={unveilForMe} disabled={loading} className="label mt-2 flex min-h-11 items-center px-1 text-[12px] text-ink-dim underline underline-offset-4">
            自分の伏せを解除
          </button>
        )}
        {error && <p role="alert" className="label mt-2 text-[12px] text-ink">{error}</p>}
        </LetterPaper>
      </article>
    );
  }

  return (
    <article id={presentation ? undefined : `post-${post.id}`} inert={presentation} className={presentation ? "related-graph__post" : "border-b border-line py-4"}>
      <LetterPaper createdAt={post.createdAt}>
      <Meta name={post.authorName} at={post.createdAt} stamp={post.stamp} note={post.returned ? "自分だけに表示" : undefined} trailing={menu} />
      <PostBody form={form} body={opened.body} imageIds={opened.imageIds} imageGrant={opened.imageGrant} />
      {post.veiled && (
        <div className="mt-2 flex items-center gap-2.5">
          <span className="label text-[11px] leading-[1.8] text-ink-faint">
            {post.kind === "cw" ? `書いた人が先に断っています　${post.reason}` : "伏せてあった紙を開いています"}
          </span>
          <button
            type="button"
            onClick={() => { setRevealed(null); onClosed?.(post.id); }}
            disabled={loading}
            className="label ml-auto flex min-h-11 shrink-0 items-center px-1 text-[12px] text-ink-dim underline underline-offset-4"
          >
            とじる
          </button>
        </div>
      )}
      {similarId && (
        <button type="button" onClick={goToSimilar} className="label mt-2 flex min-h-11 items-center px-1 text-[12px] text-ink-dim underline underline-offset-4">
          近いことを書いた人がいます
        </button>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {tags.map((t) => (
          <span key={t} className="label text-[12px] text-ink-faint">
            <span className="text-ink-faint/70">#</span>{t}
          </span>
        ))}
        {!post.mine && (
          <button
            onClick={react}
            aria-pressed={reacted}
            aria-label={reacted ? "書いた人への反応を取り消す" : "書いた人に届ける"}
            disabled={loading}
            className={`label ml-auto flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-[12px] ${reacted ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-dim"}`}
          >
            {reacted ? "届けました · 取り消す" : "書いた人に届ける"}
          </button>
        )}
        {post.mine && "received" in post && post.received && <span className="label ml-auto text-[12px] text-ink-dim">届いています</span>}
      </div>
      {error && <p role="alert" className="label mt-2 text-[12px] text-ink">{error}</p>}
      </LetterPaper>
    </article>
  );
}
