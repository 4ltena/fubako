"use client";
import { useState } from "react";
import { Blurhash } from "@/components/Blurhash";
import type { Form } from "@/lib/form";
import type { TimelinePost } from "@/lib/timeline";
import type { Wear } from "@/lib/wear";

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
 * しわ・雨の跡・角の折れ・インクの薄れを重ねるだけで、内容には触らない。
 */
function Wearing({ level }: { level: Wear }) {
  if (level === 0) return null;
  // しわは線ではなく、光のあたり方の差として置く。近づかないと見えない濃さにする。
  const crease = 0.010 + level * 0.006;
  const rain = level >= 2 ? 0.028 + level * 0.008 : 0;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[26px]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            `linear-gradient(101deg, transparent 30%, rgba(32,30,29,${crease}) 44%, transparent 58%)`,
            `linear-gradient(74deg, transparent 52%, rgba(32,30,29,${crease * 0.8}) 68%, transparent 82%)`,
          ].join(","),
        }}
      />
      {rain > 0 && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              `radial-gradient(70px 52px at 84% 80%, rgba(100,92,80,${rain}) 0%, transparent 72%)`,
              `radial-gradient(44px 34px at 20% 64%, rgba(100,92,80,${rain * 0.7}) 0%, transparent 72%)`,
            ].join(","),
          }}
        />
      )}
      {level >= 3 && (
        <div
          className="absolute right-0 top-0 h-7 w-7"
          style={{ background: "linear-gradient(225deg, var(--color-paper) 48%, rgba(32,30,29,0.07) 50%, transparent 60%)" }}
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

export function PostCard({ post, wear = 0 }: { post: TimelinePost; wear?: Wear }) {
  const [opened, setOpened] = useState<{ body: string; imageIds: string[] } | null>(post.veiled ? null : { body: post.body, imageIds: post.imageIds });
  // 伏せた投稿は form を持たない。開いたあとも形は使わず通常表示にする。
  const form: Form = post.veiled ? "text" : post.form;
  // 相手の投稿者名も本文も出さない。飛び先の id だけ持つ。
  const similarId = post.veiled ? null : (post.similar?.postId ?? null);
  const [reacted, setReacted] = useState(post.reacted);
  const [loading, setLoading] = useState(false);

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
    if (r.ok) setOpened((await r.json()) as { body: string; imageIds: string[] });
    setLoading(false);
  }
  async function react() {
    setReacted(!reacted);
    const r = await fetch(`/api/posts/${post.id}/react`, { method: "POST" });
    if (r.ok) setReacted(((await r.json()) as { reacted: boolean }).reacted);
  }

  const reason = post.veiled ? post.reason : "";
  // 伏せた理由。未確認だけは言い方を変える（書いた人の落ち度ではないため）。
  const reasonText = reason === "未確認" ? "未確認　タグがありません" : `伏せています　${reason}`;

  if (opened === null) {
    return (
      <article id={`post-${post.id}`} className="relative overflow-hidden rounded-[26px] bg-veil px-[22px] pb-4 pt-5">
        <Wearing level={wear} />
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
        </div>
      </article>
    );
  }

  return (
    <article id={`post-${post.id}`} className="relative overflow-hidden rounded-[26px] bg-card px-[22px] pb-4 pt-5 shadow-paper">
      <Wearing level={wear} />
      <div className="relative">
        <Meta name={post.authorName} at={post.createdAt} />
        <PostBody form={form} body={opened.body} imageIds={opened.imageIds} />
        {similarId && (
          <button type="button" onClick={goToSimilar} className="label mt-3 block text-[11px] tracking-[0.08em] text-ink-faint underline underline-offset-4">
            近いことを書いた人がいます
          </button>
        )}
        <div className="mt-3 flex items-center gap-2">
          {post.tags.map((t) => (
            <span key={t} className="label rounded-full bg-sage px-3 py-[5px] text-[11px] tracking-[0.06em] text-sage-ink">{t}</span>
          ))}
          {!post.mine && (
            <button
              onClick={react}
              aria-pressed={reacted}
              aria-label={reacted ? "届いた" : "届ける"}
              className={`ml-auto flex size-[42px] shrink-0 items-center justify-center rounded-full text-[15px] ${reacted ? "bg-accent-pale text-accent" : "bg-veil text-ink-faint"}`}
            >
              届
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
