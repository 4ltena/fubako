"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Blurhash } from "@/components/Blurhash";
import type { Form } from "@/lib/form";
import type { TimelinePost } from "@/lib/timeline";
import { isFolded, marksOf, paperTexture } from "@/lib/wear";

export function ImageGrid({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <ul className={`mt-3 grid gap-2 ${ids.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {ids.map((id) => (
        <li key={id}>
          <a href={`/api/images/${id}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/${id}`} alt="" loading="lazy" className="w-full rounded-[20px] object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * 紙のいたみ。数字を出さずに寿命の残りを見せる（lib/wear.ts）。
 * しわ・シミ・角の折れの位置は投稿ごとに決まっていて、いつ見ても同じ。
 */
function Wearing({ id, wear }: { id: string; wear: number }) {
  if (wear <= 0) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[26px]">
      <div className="absolute inset-0" style={{ backgroundImage: paperTexture(id, wear) }} />
      {isFolded(wear) && (
        <div
          className={`absolute top-0 h-7 w-7 ${marksOf(id).foldRight ? "right-0" : "left-0"}`}
          style={{
            background: `linear-gradient(${marksOf(id).foldRight ? 225 : 135}deg, var(--color-paper) 48%, rgba(32,30,29,0.07) 50%, transparent 60%)`,
          }}
        />
      )}
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

function Meta({ name, at }: { name: string; at: string }) {
  const t = new Date(at);
  return (
    <div className="flex items-baseline gap-3 text-xs text-ink-soft">
      <span className="text-ink">{name}</span>
      <time dateTime={at} className="tracking-[0.12em]">
        {`${t.getHours()}`.padStart(2, "0")}:{`${t.getMinutes()}`.padStart(2, "0")}
      </time>
    </div>
  );
}

export function PostCard({ post, wear = 0, preopened = null }: { post: TimelinePost; wear?: number; preopened?: { body: string; imageIds: string[] } | null }) {
  // 開いた本文はサーバから取り直したものだけを持つ。表示は毎回 props から導く。
  // （state を初期値だけで持つと、伏せ直したあとサーバが伏せて返しても紙が開いたまま残る）
  const [revealed, setRevealed] = useState<{ body: string; imageIds: string[] } | null>(null);
  const [reacted, setReacted] = useState(post.reacted);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // preopened は一覧側で「未確認も開いて見る」を押したときに渡ってくる本文。
  const opened = post.veiled ? (revealed ?? preopened) : { body: post.body, imageIds: post.imageIds };
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
    const r = await fetch(`/api/posts/${post.id}/veil`, { method: "POST" });
    if (r.ok) {
      setRevealed(null);
      router.refresh();
    }
    setLoading(false);
  }
  async function unveilForMe() {
    setLoading(true);
    const r = await fetch(`/api/posts/${post.id}/veil`, { method: "DELETE" });
    if (r.ok) router.refresh();
    setLoading(false);
  }

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
      <article id={`post-${post.id}`} className="relative overflow-hidden rounded-[26px] bg-veil px-[22px] pb-4 pt-5">
        <Wearing id={post.id} wear={wear} />
        <div className="relative">
          <Meta name={post.authorName} at={post.createdAt} />
          {/* 紙全体がタップ領域。右下の「ひらく」は目安 */}
          <button onClick={reveal} disabled={loading} className="mt-3 block w-full text-left">
            {post.images.length > 0 ? (
              <div className={`grid gap-1 overflow-hidden rounded-[20px] ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {post.images.map((img, i) => <Blurhash key={i} hash={img.blurhash} width={img.width} height={img.height} />)}
              </div>
            ) : (
              <div className="relative h-[72px] overflow-hidden rounded-[20px] bg-line">
                <div className="absolute inset-x-0 top-1/2 h-px bg-card/75" />
                <div className="ruled absolute inset-y-[18px] inset-x-[22px]" />
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
    <article id={`post-${post.id}`} className="relative overflow-hidden rounded-[26px] bg-card px-[22px] pb-4 pt-5 shadow-paper">
      <Wearing id={post.id} wear={wear} />
      <div className="relative">
        <Meta name={post.authorName} at={post.createdAt} />
        {post.veiled && post.kind === "cw" && (
          <p className="label mt-3 text-[11px] leading-[1.8] tracking-[0.06em] text-ink-faint">書いた人が先に断っています　{post.reason}</p>
        )}
        <PostBody form={form} body={opened.body} imageIds={opened.imageIds} />
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
              <button onClick={veilForMe} disabled={loading} className="label text-[11px] tracking-[0.08em] text-ink-faint underline underline-offset-4">
                これは伏せておく
              </button>
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
