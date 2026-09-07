import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { AfterwordEditor } from "@/components/AfterwordEditor";
import { BottomBar } from "@/components/BottomBar";
import { CircleArchiveButton } from "@/components/CircleArchiveButton";
import { CircleInviteControls } from "@/components/CircleInviteControls";
import { CircleLeaveForm } from "@/components/CircleLeaveForm";
import { CircleManageMembers } from "@/components/CircleManageMembers";
import { DigestPreference } from "@/components/DigestPreference";
import { NewPostForm } from "@/components/NewPostForm";
import { CircleDescriptionEditor } from "@/components/CircleDescriptionEditor";
import { TopicMuteControls } from "@/components/TopicMuteControls";
import { ExportArchiveButton } from "@/components/ExportArchiveButton";
import { ReadingPreferences } from "@/components/ReadingPreferences";
import { jstMonth } from "@/lib/stamp";
import { PostBody } from "@/components/PostCard";
import { PostList } from "@/components/PostList";
import type { Form } from "@/lib/form";
import { LetterPaper, PaperPreview } from "./LetterPaper";
import { getPreviewState, PREVIEW_USER_ID, resetPreview, subscribePreview, timelineForPreview, type PreviewState } from "./store";

function stamp(at: string) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(at));
}

function Home({ state }: { state: PreviewState }) {
  const active = state.circles.filter((circle) => !circle.archived && circle.joined);
  const shelved = state.circles.filter((circle) => circle.archived && circle.joined);
  return <div>
    <header className="flex flex-col gap-4 border-b border-line pb-4">
      <h1 className="text-[20px] font-bold">ふばこ</h1>
      <p className="text-sm leading-[2.1] text-ink-dim">招待された箱だけが並びます。外からは、この箱があること自体が見えません。</p>
    </header>
    <ul className="mt-2">
      {active.map((circle) => <li key={circle.id} className="border-b border-line"><Link href={`/c/${circle.id}`} className="flex min-h-11 items-center gap-3 py-4 text-[17px]">{circle.name}</Link></li>)}
    </ul>
    {shelved.length > 0 && <details className="mt-7 border-t border-line pt-4"><summary className="label min-h-11 cursor-pointer py-3 text-[11px] text-ink-faint">しまった箱</summary><ul>{shelved.map((circle) => <li key={circle.id} className="border-b border-line"><Link href={`/c/${circle.id}`} className="flex min-h-11 items-center py-3 text-[15px] text-ink-dim">{circle.name}</Link></li>)}</ul></details>}
    <div className="mt-8 border-t border-line pt-4"><span className="label text-[11px] text-ink-dim">表示確認用の箱</span><p className="mt-2 text-[13px] leading-6 text-ink-dim">この画面での操作はサンプルだけに反映されます。</p></div>
    <div className="mt-6"><DigestPreference initiallyEnabled={state.digestEnabled} /></div>
  </div>;
}

function Timeline({ state, circleId }: { state: PreviewState; circleId: string }) {
  const circle = state.circles.find((item) => item.id === circleId);
  const posts = timelineForPreview(circleId);
  if (!circle) return <NotFound />;
  return <div>
    <header className="flex items-center gap-3 border-b border-line pb-3"><span aria-hidden className="size-2.5 shrink-0 rounded-full bg-ink-dim" /><h1 className="text-[20px] font-bold">{circle.name}</h1><Link href="/" className="label ml-auto flex min-h-11 items-center text-[11px] text-ink-faint underline underline-offset-4">べつの箱へ</Link></header>
    {circle.description && <section className="mt-4 border-b border-line pb-4"><h2 className="label text-[11px] text-ink-faint">この箱について</h2><p className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-ink-dim">{circle.description}</p></section>}
    <details className="mt-4"><summary className="label flex min-h-11 cursor-pointer items-center text-[12px] text-ink-dim">見るまで伏せる</summary><TopicMuteControls key={JSON.stringify(state.topicMutes)} circleId={circleId} initialRules={state.topicMutes.filter((rule) => rule.circleId === circleId)} /></details>
    {posts.length === 0 ? <div className="flex flex-col gap-3 border-b border-line py-6"><p className="text-[15px] leading-[2.2] text-ink-dim">ここにはまだ何もありません。読まれないことを書いておく場所としても使えます。</p><Link href={`/c/${circleId}/new`} className="label self-start rounded-full bg-ink px-6 py-3 text-xs tracking-[0.1em] text-paper">はじめに一通書く</Link></div> : <PostList key={JSON.stringify([state.mutes, state.topicMutes.filter((rule) => rule.circleId === circleId)])} posts={posts} circleId={circleId} wears={{}} />}
    <details className="label mt-6 text-[11px] text-ink-faint"><summary className="flex min-h-11 cursor-pointer items-center">この箱の言葉</summary><div className="mt-2 space-y-3 border-t border-line pt-4"><p className="select-all text-lg tracking-[0.2em] text-ink">{circle.inviteCode}</p><div className="flex flex-wrap gap-2 border-t border-line pt-3"><CircleArchiveButton circleId={circleId} archived={circle.archived} />{circle.managerId === PREVIEW_USER_ID && <Link href={`/c/${circleId}/manage`} className="label flex min-h-11 items-center rounded-full border border-line-2 px-4 py-2 text-[11px] text-ink-dim">この箱を整える</Link>}</div><CircleLeaveForm circleId={circleId} transferRequired={false} /></div></details>
  </div>;
}

function Compose({ state, circleId }: { state: PreviewState; circleId: string }) {
  const circle = state.circles.find((item) => item.id === circleId);
  if (!circle) return <NotFound />;
  return <div><div className="mb-5 flex items-center justify-between border-b border-line pb-4"><Link href={`/c/${circleId}`} className="label text-xs text-ink-faint underline underline-offset-4">とじる</Link><span className="text-[15px]">{circle.name}へ</span><span className="label invisible text-xs">とじる</span></div><NewPostForm circleId={circleId} suggested={["新曲", "ライブ", "感想"]} draftKey={`ui-preview:${PREVIEW_USER_ID}:${circleId}`} /></div>;
}

function Archive({ state }: { state: PreviewState }) {
  const search = useSearchParams();
  const own = state.posts.filter((post) => post.mine).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [openedAt] = useState(() => Date.now());
  const month = search.get("month") ?? jstMonth(new Date(own[0]?.createdAt ?? openedAt));
  const posts = own.filter((post) => jstMonth(new Date(post.createdAt)) === month);
  const now = new Date().getTime();
  return <div>
    <header className="border-b border-line pb-5">
      <h1 className="text-[20px] font-bold">じぶんの箱</h1>
      <p className="mt-3 text-sm leading-[2.1] text-ink-dim">書いた紙は、公開期間が終わってもここに残ります。後書きは自分だけに見えます。</p>
      <form className="mt-5 flex items-end gap-3" action="/archive">
        <label className="label flex min-h-11 flex-col justify-center gap-1 text-[12px] text-ink-dim">年月<input key={month} name="month" type="month" defaultValue={month} className="min-h-11 border border-line bg-paper px-3 text-[14px] text-ink" /></label>
        <button className="label min-h-11 px-3 text-[12px] text-ink underline underline-offset-4">表示する</button>
      </form>
      <ExportArchiveButton month={month} />
    </header>
    {posts.length === 0 ? <p className="py-8 text-sm leading-[2.1] text-ink-dim">{month} に書いた紙はまだありません。</p> : <ul>{posts.map((post) => {
      const published = post.visibility === "circle" && new Date(post.expiresAt).getTime() > now;
      return <li key={post.id} className="letter-archive-item"><LetterPaper createdAt={post.createdAt}>
        <div className="label flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-ink-dim"><span className="text-ink">{state.circles.find((circle) => circle.id === post.circleId)?.name}</span><time dateTime={post.createdAt}>{stamp(post.createdAt)}</time><span>{published ? "箱で公開中" : "自分だけに表示"}</span>{post.received && <span>届いています</span>}</div>
        {post.cw && <p className="label mt-3 text-[12px] leading-[1.8] text-ink-dim">注意文　{post.cw}</p>}
        <PostBody form={post.form as Form} body={post.body} imageIds={post.imageIds} />
        {post.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{post.tags.map((tag) => <span key={tag} className="label text-[12px] text-ink-dim">#{tag}</span>)}</div>}
        <AfterwordEditor postId={post.id} initialAfterword={post.afterword} />
        <div className="label mt-3 flex min-h-11 items-center gap-4 text-[12px] text-ink-dim">
          {published && <ActionButton method="PATCH" url={`/api/posts/${post.id}`} body={{ expireNow: true }} className="min-h-11 px-3 underline underline-offset-4">公開を終える</ActionButton>}
          <ActionButton method="DELETE" url={`/api/posts/${post.id}`} className="min-h-11 px-3 underline underline-offset-4">削除</ActionButton>
        </div>
      </LetterPaper></li>;
    })}</ul>}
  </div>;
}

function Mutes({ state }: { state: PreviewState }) {
  return <div><Link href="/settings/reading" className="label mb-4 flex min-h-11 items-center text-[12px] underline underline-offset-4">読みやすさを整える</Link><header className="flex flex-col gap-4 border-b border-line pb-4"><h1 className="text-[20px] font-bold">見たくない語</h1><p className="text-sm leading-[2.1] text-ink-dim">書いておくと、その語を持つ投稿は本文を伏せたまま届きます。開けるかどうかは、そのとき決めればいい。</p></header><form method="post" action="/api/me/mutes" className="mt-5 flex items-center gap-3 border-b border-line pb-3"><input name="word" required maxLength={40} placeholder="語を書く" className="flex-1 bg-transparent text-[15px] placeholder:text-ink-faint focus:outline-none" /><button className="label shrink-0 rounded-full bg-ink px-6 py-2.5 text-xs tracking-[0.1em] text-paper">しまう</button></form>{state.mutes.length > 0 && <ul className="mt-4 flex flex-wrap gap-2.5 border-b border-line py-4">{state.mutes.map((rule) => <li key={rule.id} className="label flex items-center gap-3 rounded-full border border-line-2 px-4 py-2 text-sm">{rule.word}<ActionButton method="DELETE" url={`/api/me/mutes?id=${rule.id}`} className="text-ink-dim" aria-label="外す">×</ActionButton></li>)}</ul>}<p className="label mt-6 text-[11px] text-ink-faint">漏れていたら、その紙の「…」からその場で伏せられます</p>{[...new Set(state.topicMutes.map((rule) => rule.circleId))].map((id) => <div key={id} className="mt-6"><TopicMuteControls key={JSON.stringify(state.topicMutes.filter((rule) => rule.circleId === id))} circleId={id} initialRules={state.topicMutes.filter((rule) => rule.circleId === id)} allowAdd={false} /></div>)}</div>;
}

function Manage({ state, circleId }: { state: PreviewState; circleId: string }) {
  const circle = state.circles.find((item) => item.id === circleId);
  if (!circle || circle.managerId !== PREVIEW_USER_ID) return <NotFound />;
  return <div className="space-y-6"><header className="border-b border-line pb-4"><h1 className="text-[20px] font-bold">{circle.name}を整える</h1><p className="mt-2 text-[13px] leading-6 text-ink-dim">参加者の活動や反応は表示しません。</p></header><CircleDescriptionEditor circleId={circleId} initialDescription={circle.description} /><CircleInviteControls circleId={circleId} enabled={circle.invitesEnabled} inviteCode={circle.inviteCode} /><CircleManageMembers circleId={circleId} members={circle.members} bans={circle.bans} managerId={circle.managerId} /></div>;
}

function NotFound() { return <p className="py-8 text-sm leading-[2.1] text-ink-dim">この表示確認用の箱は見つかりません。</p>; }

export default function App() {
  const state = useSyncExternalStore(subscribePreview, getPreviewState, getPreviewState);
  const path = usePathname();
  const match = path.match(/^\/c\/([^/]+)(?:\/(new|manage))?$/);
  const circleId = match?.[1];
  const page = path === "/" ? <Home state={state} /> : path === "/archive" ? <Archive state={state} /> : path === "/settings/reading" ? <><ReadingPreferences /><Link href="/settings/mutes" className="label mt-5 flex min-h-11 items-center text-[12px] underline underline-offset-4">見たくない語へ戻る</Link></> : path === "/settings/mutes" ? <Mutes state={state} /> : circleId && match?.[2] === "new" ? <Compose state={state} circleId={circleId} /> : circleId && match?.[2] === "manage" ? <Manage state={state} circleId={circleId} /> : circleId ? <Timeline state={state} circleId={circleId} /> : <NotFound />;
  return <div className="min-h-screen bg-paper pb-28"><main className="mx-auto max-w-[600px] px-5 pb-10 pt-5"><div className="label mb-5 flex min-h-11 items-center justify-between gap-3 border border-line bg-paper-2 px-3 text-[11px] text-ink-dim"><span>表示確認用・サンプルデータ</span><button type="button" onClick={() => { if (window.confirm("表示確認用のサンプルを初期状態に戻しますか？")) resetPreview(); }} className="min-h-11 px-2 underline underline-offset-4">サンプルを戻す</button></div><PaperPreview>{page}</PaperPreview></main><BottomBar /></div>;
}
