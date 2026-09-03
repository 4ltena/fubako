"use client";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Blurhash } from "@/components/Blurhash";
import type { Form } from "@/lib/form";
import type { TimelinePost } from "@/lib/timeline";
import { foldsRight, foldStyle, isFolded, paperTexture } from "@/lib/wear";

export function ImageGrid({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (ids.length === 0) return null;
  return (
    <>
      <ul className={`mt-3 grid gap-2 ${ids.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {ids.map((id) => (
          <li key={id}>
            <button type="button" onClick={() => setOpen(id)} className="block w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/images/${id}`} alt="" loading="lazy" className="washed w-full rounded-[20px] object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {open &&
        // じぶんの箱では紙が傾いている（transform）ので、その中に置くと
        // fixed の基準がその紙になってしまう。body の直下に出す。
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setOpen(null)}
            className="fixed inset-0 z-30 flex items-center justify-center bg-paper/90 p-6"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/${open}`} alt="" className="max-h-full max-w-full rounded-[26px] object-contain shadow-lift" />
            <button type="button" onClick={() => setOpen(null)} className="label absolute right-6 top-6 rounded-full bg-card px-4 py-2 text-[11px] tracking-[0.14em] text-ink-soft shadow-paper">
              とじる
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * 紙のいたみ。数字を出さずに寿命の残りを見せる（lib/wear.ts）。
 * しわ・シミ・角の折れの位置は投稿ごとに決まっていて、いつ見ても同じ。
 */
function Wearing({ id, wear }: { id: string; wear: number }) {
  if (wear <= 0) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]">
      <div className="absolute inset-0" style={{ backgroundImage: paperTexture(id, wear) }} />
      {isFolded(wear) && <div className={`absolute top-0 h-7 w-7 ${foldsRight(id) ? "right-0" : "left-0"}`} style={foldStyle(id)} />}
    </div>
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
      ? "mt-3 text-[17px] leading-[1.9]" // 一文: やや大きく1行で
      : form === "verse"
        ? "mt-3 whitespace-pre-wrap text-center text-[15px] leading-[2.6]" // 一句: 中央揃え・行間広め
        : "mt-3 whitespace-pre-wrap text-[15px] leading-[2.15]";
  return (
    <>
      <p className={className}>{body}</p>
      <ImageGrid ids={imageIds} />
    </>
  );
}

function Meta({ name, at, stamp, note, trailing }: { name: string; at: string; stamp: string; note?: string; trailing?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-xs text-ink-soft">
      <span className="text-ink">{name}</span>
      {/* 時刻は lib/stamp.ts が JST で作ったものをそのまま出す */}
      <time dateTime={at} className="tracking-[0.12em]">{stamp}</time>
      {note && <span className="label text-[11px] tracking-[0.08em] text-ink-faint">{note}</span>}
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
  // （state を初期値だけで持つと、伏せ直したあとサーバが伏せて返しても紙が開いたまま残る）
  const [revealed, setRevealed] = useState<{ body: string; imageIds: string[] } | null>(null);
  const [reacted, setReacted] = useState(post.reacted);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  // preopened は一覧側で「未確認も開いて見る」を押したときに渡ってくる本文。
  // 自分で伏せた紙にはどちらも使わない（伏せたのに開いたまま残らないように）。
  const selfVeiled = post.veiled && post.kind === "self";
  const opened = post.veiled ? (selfVeiled ? null : (revealed ?? preopened)) : { body: post.body, imageIds: post.imageIds };
  // 伏せた投稿は form を持たない。開いたあとも形は使わず通常表示にする。
  const form: Form = post.veiled ? "text" : post.form;
  // 相手の投稿者名も本文も出さない。飛び先の id だけ持つ。
  const similarId = post.veiled ? null : (post.similar?.postId ?? null);
  const tags = post.veiled ? [] : post.tags;

  /** 近い投稿まで運ぶ。ページは変えない。 */
  function goToSimilar() {
    const el = similarId === null ? null : document.getElementById(`post-${similarId}`);
    if (el === null) return;
    const before = window.scrollY;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // 滑らかな移動が効かない環境では何も起きないことがある。動いていなければ飛ばす。
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
      // 一覧側が持っている本文も落としてもらう
      onVeiled?.(post.id);
      router.refresh();
    }
    setLoading(false);
  }
  /** 自分の紙を、いま他の人から引き取る（じぶんの箱には残る）。 */
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

  // 紙の右上の「…」。ブロックや通報は置かない（デザイン案 1g の注記どおり）。
  const menu = (
    <span className="relative ml-auto -mr-2 -mt-2">
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="この紙について"
        aria-expanded={menuOpen}
        className="label flex size-8 items-center justify-center rounded-full text-sm text-ink-faint"
      >
        …
      </button>
      {menuOpen && (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <span className="absolute right-0 top-9 z-20 block w-max rounded-[28px] bg-card p-2.5 text-sm tracking-[0.06em] shadow-lift">
            {post.mine ? (
              post.returned ? (
                <span className="block w-max px-[18px] py-[15px] text-ink-faint">もう他の人からは見えません</span>
              ) : (
                <button type="button" onClick={pullBack} disabled={loading} className="block w-full rounded-[20px] px-[18px] py-[15px] text-left">
                  いま引き取る
                </button>
              )
            ) : post.veiled && post.kind === "self" ? (
              <button type="button" onClick={unveilForMe} disabled={loading} className="block w-full rounded-[20px] px-[18px] py-[15px] text-left">
                伏せたのを戻す
              </button>
            ) : (
              <button type="button" onClick={veilForMe} disabled={loading} className="block w-full rounded-[20px] px-[18px] py-[15px] text-left">
                この紙をしまう
              </button>
            )}
          </span>
        </>
      )}
    </span>
  );

  // 伏せた理由の文言。種類ごとに言い方を変える（書いた人の落ち度にしない）。
  const reasonText = !post.veiled
    ? ""
    : post.kind === "unconfirmed"
      ? "未確認　タグがありません"
      : post.kind === "cw"
        ? `書いた人が先に断っています　${post.reason}`
        : post.kind === "self"
          ? "自分で伏せています"
          : `宣言した語と一致しました　${post.reason}`;

  if (opened === null) {
    return (
      <article id={`post-${post.id}`} className="relative rounded-[26px] bg-veil px-[22px] pb-4 pt-5">
        <Wearing id={post.id} wear={wear} />
        <div className="relative">
          <Meta name={post.authorName} at={post.createdAt} stamp={post.stamp} trailing={post.veiled && post.kind === "unconfirmed" ? undefined : menu} />
          {/* 紙全体がタップ領域。右下の「ひらく」は目安 */}
          <button onClick={reveal} disabled={loading} className="mt-3 block w-full text-left">
            {post.images.length > 0 ? (
              <div className={`grid gap-1 overflow-hidden rounded-[20px] ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {post.images.map((img, i) => <Blurhash key={i} hash={img.blurhash} width={img.width} height={img.height} />)}
              </div>
            ) : (
              <div className={`relative overflow-hidden rounded-[20px] bg-slot ${post.veiled && post.kind === "unconfirmed" ? "h-[44px]" : "h-[72px]"}`}>
                <div className="absolute inset-x-0 top-1/2 h-px bg-slot-rule" />
                <div className={`ruled absolute inset-x-[22px] ${post.veiled && post.kind === "unconfirmed" ? "inset-y-4" : "inset-y-[18px]"}`} />
              </div>
            )}
            <span className="mt-3 flex items-center gap-2.5">
              <span className="label text-[11px] leading-[1.8] tracking-[0.06em] text-ink-faint">{reasonText}</span>
              <span className="label ml-auto shrink-0 rounded-full bg-ink-faint px-[18px] py-[7px] text-[11px] text-card">ひらく</span>
            </span>
          </button>
          {post.veiled && post.kind === "self" && (
            <button onClick={unveilForMe} disabled={loading} className="label mt-3 block text-[11px] tracking-[0.08em] text-ink-faint underline underline-offset-4">
              伏せたのを戻す
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article id={`post-${post.id}`} className="relative rounded-[26px] bg-card px-[22px] pb-4 pt-5 shadow-paper">
      <Wearing id={post.id} wear={wear} />
      <div className="relative">
        <Meta name={post.authorName} at={post.createdAt} stamp={post.stamp} note={post.returned ? "もどってきた" : undefined} trailing={menu} />
        <PostBody form={form} body={opened.body} imageIds={opened.imageIds} />
        {post.veiled && (
          // 開けた紙は、伏せてあったことを一行残してまた伏せられる（デザイン案 1g）
          <div className="mt-3 flex items-center gap-2.5">
            <span className="label text-[11px] leading-[1.8] tracking-[0.06em] text-ink-soft">
              {post.kind === "cw" ? `書いた人が先に断っています　${post.reason}` : "伏せてあった紙を開いています"}
            </span>
            <button
              type="button"
              onClick={veilForMe}
              disabled={loading}
              className="label ml-auto shrink-0 rounded-full bg-veil px-4 py-[9px] text-[11px] tracking-[0.14em] text-ink-soft"
            >
              また伏せる
            </button>
          </div>
        )}
        {similarId && (
          <button type="button" onClick={goToSimilar} className="label mt-3 block text-[11px] tracking-[0.08em] text-ink-faint underline underline-offset-4">
            近いことを書いた人がいます
          </button>
        )}
        <div className="mt-3 flex items-center gap-2">
          {tags.map((t) => (
            <span key={t} className="label rounded-full bg-sage px-3 py-[5px] text-[11px] tracking-[0.06em] text-sage-ink">{t}</span>
          ))}
          {!post.mine && (
            <>
              <button
                onClick={react}
                aria-pressed={reacted}
                aria-label={reacted ? "届いた" : "届ける"}
                className={`ml-auto flex size-[42px] shrink-0 items-center justify-center rounded-full text-[15px] ${reacted ? "bg-accent-pale text-accent" : "bg-veil text-ink-faint"}`}
              >
                届
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
