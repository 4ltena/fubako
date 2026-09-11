import type { Form } from "@/lib/form";
import type { TimelinePost } from "@/lib/timeline";
import { exportHeading, exportRecord } from "@/lib/export-records";
import { jstMonth, jstStamp } from "@/lib/stamp";
import { normalizeWord, veilFor } from "@/lib/veil";
import { relatedPosts } from "@/lib/similarity-graph";
import { moonGardenDemo } from "./moon-garden-demo";

/** UI確認だけに使う、ログイン済みの架空の利用者。 */
export const PREVIEW_USER_ID = "preview-me";

export type PreviewPost = {
  id: string;
  circleId: string;
  authorName: string;
  mine: boolean;
  body: string;
  cw: string | null;
  tags: string[];
  createdAt: string;
  expiresAt: string;
  afterword: string;
  received: boolean;
  reacted: boolean;
  selfVeiled: boolean;
  imageIds: string[];
  form: Form;
  visibility: "circle" | "private";
};

export type PreviewCircle = {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  invitesEnabled: boolean;
  archived: boolean;
  managerId: string;
  members: { id: string; name: string }[];
  bans: { id: string; name: string }[];
  joined: boolean;
};

export type PreviewState = {
  path: string;
  circles: PreviewCircle[];
  posts: PreviewPost[];
  mutes: { id: string; word: string }[];
  topicMutes: { id: string; circleId: string; word: string }[];
  digestEnabled: boolean;
};

type Listener = () => void;

const sampleImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="#d9e3d5"/><circle cx="250" cy="210" r="128" fill="#f5ead8"/><path d="M0 500C180 390 360 570 540 445s280-80 420-15v210H0z" fill="#7e9f8a"/><text x="68" y="570" fill="#385044" font-family="sans-serif" font-size="36">preview image</text></svg>',
)}`;

const imageUrls = new Map<string, string>([["preview-image-1", sampleImage]]);
const generatedUrls = new Set<string>();
let sequence = 0;

function id(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function iso(offsetDays: number, hour: number) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  now.setUTCHours(hour, 0, 0, 0);
  return now.toISOString();
}

function initialState(): PreviewState {
  return {
    path: "/c/preview-room",
    circles: [
      {
        id: "preview-room",
        name: "新曲を聴いた夜",
        description: "新曲を聴いた日の、小さな感想を置いておく箱です。",
        inviteCode: "ほしぞらことば",
        invitesEnabled: true,
        archived: false,
        managerId: PREVIEW_USER_ID,
        members: [
          { id: PREVIEW_USER_ID, name: "わたし" },
          { id: "preview-rin", name: "りん" },
          { id: "preview-ao", name: "あお" },
        ],
        bans: [],
        joined: true,
      },
      {
        id: "preview-shelf",
        name: "春のライブのあと",
        description: "春の記録を、急がず読み返すための箱です。",
        inviteCode: "はるのよいん",
        invitesEnabled: true,
        archived: true,
        managerId: "preview-rin",
        members: [{ id: PREVIEW_USER_ID, name: "わたし" }, { id: "preview-rin", name: "りん" }],
        bans: [],
        joined: true,
      },
      {
        id: "preview-starlight", name: "星あかりの余白",
        description: "架空の舞台『月舟の庭』から、登場人物や場面の感想をたどるためのデモです。",
        inviteCode: "ほしあかりをあつめて", invitesEnabled: true, archived: false, managerId: PREVIEW_USER_ID,
        members: [{ id: PREVIEW_USER_ID, name: "わたし" }, ...["しおり", "なぎ", "こはく"].map((name) => ({ id: `preview-${name}`, name }))],
        bans: [], joined: true,
      },
    ],
    posts: [
      ...moonGardenDemo.map((post, index) => ({
        id: `preview-moon-${post.slug}`, circleId: "preview-starlight", authorName: post.name, mine: false,
        body: post.body, tags: post.tags, cw: null, createdAt: new Date(new Date(iso(0, 8)).getTime() - index * 240_000).toISOString(), expiresAt: iso(7, 8),
        afterword: "", received: false, reacted: false, selfVeiled: false, imageIds: [], form: "text" as const, visibility: "circle" as const,
      })),
      ...[
        { id: "preview-graph-song", authorName: "あお", body: "新曲を聴きながら、ライブで見た青い光を思い出していた。あの続きを、また同じ場所で聴けたら。", tags: ["新曲", "ライブ"] },
        { id: "preview-graph-piano", authorName: "しおり", body: "ライブの最後に響いたピアノ。一音ずつ、遠い窓に明かりがともるようだった。", tags: ["ライブ", "ピアノ"] },
        { id: "preview-graph-night", authorName: "なぎ", body: "ピアノの余韻と、静かな夜。読みかけの本を閉じるまで、音の中を歩いていた。", tags: ["ピアノ", "夜"] },
        { id: "preview-graph-book", authorName: "こはく", body: "夜の読書には、急がない音楽が似合う。今日の物語にも、ひとつ栞を。", tags: ["夜", "読書"] },
      ].map((post) => ({ ...post, circleId: "preview-room", mine: false, cw: null, createdAt: iso(0, 8), expiresAt: iso(7, 8), afterword: "", received: false, reacted: false, selfVeiled: false, imageIds: [], form: "text" as const, visibility: "circle" as const })),
      {
        id: "preview-mine-received", circleId: "preview-room", authorName: "わたし", mine: true,
        body: "最後の一音が、まだ耳に残っている。", cw: null, tags: ["新曲", "余韻"],
        createdAt: iso(0, 9), expiresAt: iso(7, 9), afterword: "明日ももう一度聴こう。", received: true, reacted: false, selfVeiled: false,
        imageIds: ["preview-image-1"], form: "sentence", visibility: "circle",
      },
      {
        id: "preview-mine-quiet", circleId: "preview-room", authorName: "わたし", mine: true,
        body: "ここに置けただけで、少し落ち着いた。", cw: null, tags: ["感想"],
        createdAt: iso(-1, 16), expiresAt: iso(6, 16), afterword: "", received: false, reacted: false, selfVeiled: false,
        imageIds: [], form: "sentence", visibility: "circle",
      },
      {
        id: "preview-other-open", circleId: "preview-room", authorName: "りん", mine: false,
        body: "衣装の色がとてもきれいだった。", cw: null, tags: ["衣装", "ライブ"],
        createdAt: iso(0, 7), expiresAt: iso(7, 7), afterword: "他人の後書きはありません", received: false, reacted: false, selfVeiled: false,
        imageIds: [], form: "sentence", visibility: "circle",
      },
      {
        id: "preview-other-cw", circleId: "preview-room", authorName: "あお", mine: false,
        body: "終盤の演出について書いています。", cw: "終盤の演出に触れます", tags: ["ライブ"],
        createdAt: iso(-1, 21), expiresAt: iso(6, 21), afterword: "", received: false, reacted: false, selfVeiled: false,
        imageIds: [], form: "text", visibility: "circle",
      },
      {
        id: "preview-other-muted", circleId: "preview-room", authorName: "りん", mine: false,
        body: "ネタバレを含むので、読み終えてからどうぞ。", cw: null, tags: ["感想"],
        createdAt: iso(-2, 18), expiresAt: iso(5, 18), afterword: "", received: false, reacted: false, selfVeiled: false,
        imageIds: [], form: "text", visibility: "circle",
      },
      {
        id: "preview-other-untagged", circleId: "preview-room", authorName: "あお", mine: false,
        body: "今日は、ただ静かにうれしかった。", cw: null, tags: [],
        createdAt: iso(-3, 10), expiresAt: iso(4, 10), afterword: "", received: false, reacted: false, selfVeiled: false,
        imageIds: [], form: "sentence", visibility: "circle",
      },
      {
        id: "preview-other-self-veiled", circleId: "preview-room", authorName: "りん", mine: false,
        body: "読み返すには少し強すぎる感想。", cw: null, tags: ["感想"],
        createdAt: iso(-4, 12), expiresAt: iso(3, 12), afterword: "", received: false, reacted: false, selfVeiled: true,
        imageIds: [], form: "sentence", visibility: "circle",
      },
      {
        id: "preview-previous-month", circleId: "preview-room", authorName: "わたし", mine: true,
        body: "先月の余韻も、ここに残っている。", cw: null, tags: ["記録"],
        createdAt: iso(-35, 10), expiresAt: iso(-28, 10), afterword: "この日のことは、もう少し先で思い出す。", received: false, reacted: false, selfVeiled: false,
        imageIds: [], form: "sentence", visibility: "circle",
      },
      {
        id: "preview-mine-private", circleId: "preview-room", authorName: "わたし", mine: true,
        body: "まだ誰にも見せず、自分の箱にだけ置いておく。", cw: null, tags: ["下書きの続き"],
        createdAt: iso(-2, 8), expiresAt: iso(5, 8), afterword: "今はここまで。", received: false, reacted: false, selfVeiled: false,
        imageIds: [], form: "sentence", visibility: "private",
      },
    ],
    mutes: [{ id: "preview-mute-spoiler", word: "ネタバレ" }],
    topicMutes: [{ id: "preview-topic-finale", circleId: "preview-room", word: "最終回" }],
    digestEnabled: true,
  };
}

function copyState(source: PreviewState): PreviewState {
  return {
    path: source.path,
    circles: source.circles.map((circle) => ({ ...circle, members: circle.members.map((member) => ({ ...member })), bans: circle.bans.map((ban) => ({ ...ban })) })),
    posts: source.posts.map((post) => ({ ...post, tags: [...post.tags], imageIds: [...post.imageIds] })),
    mutes: source.mutes.map((mute) => ({ ...mute })),
    topicMutes: source.topicMutes.map((mute) => ({ ...mute })),
    digestEnabled: source.digestEnabled,
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

let state = initialState();
let snapshot = freeze(copyState(state));
const listeners = new Set<Listener>();

function publish() {
  snapshot = freeze(copyState(state));
  listeners.forEach((listener) => listener());
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function notFound() { return json({ error: "not found" }, 404); }

async function requestBody(init?: RequestInit): Promise<Record<string, string>> {
  const body = init?.body;
  if (body instanceof FormData) {
    const values: Record<string, string> = {};
    body.forEach((value, key) => { if (typeof value === "string") values[key] = value; });
    return values;
  }
  if (typeof body === "string") {
    try { return JSON.parse(body) as Record<string, string>; } catch { return {}; }
  }
  return {};
}

function findPost(postId: string) { return state.posts.find((post) => post.id === postId); }
function findCircle(circleId: string) { return state.circles.find((circle) => circle.id === circleId); }

function exportText(month: string): string {
  const now = new Date();
  const records = state.posts
    .filter((post) => post.mine && jstMonth(new Date(post.createdAt)) === month)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const header = exportHeading(month);
  if (records.length === 0) return `${header}この月の記録はありません。\n`;
  return header + records.map((post) => exportRecord({
    body: post.body,
    cw: post.cw,
    tags: post.tags,
    afterword: post.afterword,
    createdAt: new Date(post.createdAt),
    expiresAt: new Date(post.expiresAt),
    visibility: post.visibility,
  }, now)).join("");
}

/** React の useSyncExternalStore にそのまま渡せる、不変のスナップショット。 */
export function getPreviewState(): PreviewState { return snapshot; }

export function subscribePreview(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Next のルーターを通さず、プレビュー内でだけ経路を動かす。 */
export function navigate(path: string) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return;
  state = { ...state, path };
  // /ui-preview の配信先から外へ遷移しない。経路は hash 内だけで持つ。
  if (typeof window !== "undefined" && window.history) window.history.pushState({ preview: true }, "", `#${path}`);
  publish();
}

export function refresh() { publish(); }

export function resetPreview() {
  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    for (const url of generatedUrls) URL.revokeObjectURL(url);
  }
  generatedUrls.clear();
  imageUrls.clear();
  imageUrls.set("preview-image-1", sampleImage);
  sequence = 0;
  state = initialState();
  publish();
}

/** プレビューで添付された画像を含め、外部に出ないURLだけを返す。 */
export function previewImageUrl(imageId: string | null | undefined) {
  if (!imageId) return sampleImage;
  return imageUrls.get(imageId) ?? sampleImage;
}

/** UI部品が使う TimelinePost。後書きや非表示語はここに含めない。 */
export function timelineForPreview(circleId: string): TimelinePost[] {
  const now = new Date();
  const muted = [...state.mutes.map((mute) => mute.word), ...state.topicMutes.filter((mute) => mute.circleId === circleId).map((mute) => mute.word)];
  const posts: TimelinePost[] = state.posts
    // 最初から自分だけに保存した紙は、書いた本人にも箱の並びには出さない。
    .filter((post) => post.circleId === circleId && post.visibility === "circle" && (post.mine || Date.parse(post.expiresAt) > now.getTime()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((post) => {
      const base = {
        id: post.id,
        authorName: post.authorName,
        mine: post.mine,
        createdAt: post.createdAt,
        stamp: jstStamp(new Date(post.createdAt), now),
        expiresAt: post.expiresAt,
        returned: post.mine && new Date(post.expiresAt).getTime() <= now.getTime(),
        reacted: post.reacted,
        images: post.imageIds.map(() => ({ blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj", width: 960, height: 640 })),
        ...(post.mine && post.received ? { received: true } : {}),
      };
      const veil = post.mine ? { veiled: false as const } : veilFor(
        { body: post.body, cw: post.cw, tags: post.tags }, muted, { selfVeiled: post.selfVeiled },
      );
      if (veil.veiled) return { ...base, veiled: true as const, reason: veil.reason, kind: veil.kind };
      return { ...base, veiled: false as const, body: post.body, imageIds: [...post.imageIds], form: post.form, tags: [...post.tags] };
    });
  // 架空データのタグを語として使う。本番はサーバーで本文を形態素解析する。
  const candidates = posts.map((post) => {
    const original = state.posts.find((item) => item.id === post.id)!;
    return { id: post.id, authorId: original.mine ? PREVIEW_USER_ID : original.authorName, terms: original.tags, veiled: post.returned || veilFor(original, muted, { selfVeiled: original.selfVeiled }).veiled };
  });
  return posts.map((post) => {
    if (post.veiled) return post;
    const related = relatedPosts(candidates.find((candidate) => candidate.id === post.id)!, candidates);
    return { ...post, ...(related.length ? { related, ...(!post.mine ? { similar: { postId: related[0].postId } } : {}) } : {}) };
  });
}

function blobUrl(blob: Blob): string {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const url = URL.createObjectURL(blob);
    generatedUrls.add(url);
    return url;
  }
  return sampleImage;
}

/**
 * 実APIには絶対に渡さない、UI確認用の小さなfetch実装。
 * 呼び出し形は既存のクライアント部品に合わせている。
 */
export async function previewFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const url = new URL(raw, "http://preview.local");
  const path = url.pathname;
  const method = (init.method ?? (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET")).toUpperCase();
  const body = await requestBody(init);

  if (method === "GET" && path.startsWith("/api/images/")) {
    const imageUrl = previewImageUrl(path.slice("/api/images/".length));
    return new Response(imageUrl === sampleImage ? sampleImage : imageUrl, { status: 200, headers: { "content-type": "image/svg+xml" } });
  }
  if (method === "GET" && path === "/api/me/mutes") return json({ rules: state.mutes });
  if (method === "GET" && path === "/api/me/export") {
    const month = url.searchParams.get("month") ?? "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ error: "month" }, 400);
    return new Response(exportText(month), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="fubako-${month}.txt"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (method === "GET" && path === "/api/me/topic-mutes") {
    const circleId = url.searchParams.get("circleId");
    return json({ rules: circleId ? state.topicMutes.filter((rule) => rule.circleId === circleId) : state.topicMutes });
  }
  if (method === "POST" && path === "/api/me/topic-mutes") {
    const circleId = body.circleId;
    const word = body.word?.trim();
    const circle = circleId ? findCircle(circleId) : undefined;
    if (!circle || !circle.joined || !word || word.length > 40 || !normalizeWord(word)) return json({ error: "word" }, 400);
    const normalized = normalizeWord(word);
    let rule = state.topicMutes.find((item) => item.circleId === circleId && normalizeWord(item.word) === normalized);
    if (!rule) {
      rule = { id: id("topic"), circleId, word };
      state = { ...state, topicMutes: [...state.topicMutes, rule] };
      publish();
    }
    return json({ id: rule.id, circleId: rule.circleId, word: rule.word });
  }
  if (method === "DELETE" && path === "/api/me/topic-mutes") {
    const circleId = url.searchParams.get("circleId");
    const ruleId = url.searchParams.get("id");
    state = { ...state, topicMutes: state.topicMutes.filter((rule) => !(rule.id === ruleId && rule.circleId === circleId)) };
    publish();
    return json({ ok: true });
  }
  if (method === "POST" && path === "/api/me/digest") {
    state = { ...state, digestEnabled: body.enabled === "true" };
    publish();
    return json({ enabled: state.digestEnabled });
  }
  if (path === "/api/me/mutes" && method === "POST") {
    const word = body.word?.trim();
    if (!word) return json({ error: "word" }, 400);
    if (!state.mutes.some((mute) => mute.word === word)) state = { ...state, mutes: [...state.mutes, { id: id("mute"), word }] };
    publish();
    return json({ id: state.mutes.find((mute) => mute.word === word)?.id, word });
  }
  if (path === "/api/me/mutes" && method === "DELETE") {
    const muteId = url.searchParams.get("id");
    state = { ...state, mutes: state.mutes.filter((mute) => mute.id !== muteId) };
    publish();
    return json({ ok: true });
  }
  if (method === "POST" && path === "/api/posts") {
    const form = init.body instanceof FormData ? init.body : null;
    const circleId = form?.get("circleId")?.toString() ?? body.circleId;
    const circle = circleId ? findCircle(circleId) : undefined;
    if (!circle || !circle.joined) return notFound();
    const files = form ? form.getAll("images").filter((item): item is File => item instanceof File) : [];
    const bodyText = form?.get("body")?.toString() ?? body.body ?? "";
    const cw = form?.get("cw")?.toString() ?? body.cw ?? "";
    const tagsText = form?.get("tags")?.toString() ?? body.tags ?? "";
    const visibility = (form?.get("visibility")?.toString() ?? body.visibility ?? "circle") as string;
    const days = Number(form?.get("days")?.toString() ?? body.days ?? 7);
    if (!bodyText.trim() && files.length === 0) return json({ error: "body" }, 400);
    if (visibility !== "circle" && visibility !== "private") return json({ error: "visibility" }, 400);
    const clientRequestId = form?.get("clientRequestId")?.toString() ?? body.clientRequestId;
    const existing = clientRequestId ? state.posts.find((post) => post.id === `request-${clientRequestId}`) : undefined;
    if (existing) return json({ id: existing.id });
    const imageIds = files.map((file) => {
      const imageId = id("preview-upload");
      imageUrls.set(imageId, blobUrl(file));
      return imageId;
    });
    const created = new Date();
    // privateにも保存形としての期限は持たせるが、箱の公開判定には使わない。
    const expires = new Date(created.getTime() + Math.max(1, Math.min(7, Number.isFinite(days) ? days : 7)) * 86_400_000);
    const postId = clientRequestId ? `request-${clientRequestId}` : id("post");
    const post: PreviewPost = {
      id: postId, circleId, authorName: "わたし", mine: true, body: bodyText, cw: cw || null,
      tags: tagsText.split(/\s+/).map((tag) => tag.trim()).filter(Boolean), createdAt: created.toISOString(), expiresAt: expires.toISOString(),
      afterword: "", received: false, reacted: false, selfVeiled: false, imageIds,
      form: imageIds.length > 0 && !bodyText.trim() ? "picture" : bodyText.trim().length <= 40 && !bodyText.includes("\n") ? "sentence" : "text",
      visibility,
    };
    state = { ...state, posts: [post, ...state.posts] };
    publish();
    return json({ id: post.id });
  }

  const postMatch = path.match(/^\/api\/posts\/([^/]+)(?:\/(reveal|react|veil|afterword))?$/);
  if (postMatch) {
    const [, postId, action] = postMatch;
    const post = findPost(postId);
    if (!post) return notFound();
    if (post.visibility === "private" && !post.mine) return notFound();
    if (action === "reveal" && method === "GET") return json({ body: post.body, imageIds: post.imageIds, imageGrant: "preview" });
    if (action === "react" && method === "POST") {
      if (post.mine) return notFound();
      post.reacted = !post.reacted;
      publish();
      return json({ reacted: post.reacted });
    }
    if (action === "veil" && (method === "POST" || method === "DELETE")) {
      if (post.mine) return notFound();
      post.selfVeiled = method === "POST";
      publish();
      return json({ ok: true });
    }
    if (action === "afterword") {
      if (!post.mine) return notFound();
      if (method === "GET") return json({ afterword: post.afterword });
      if (method === "PUT") { post.afterword = body.afterword ?? ""; publish(); return json({ afterword: post.afterword }); }
      if (method === "DELETE") { post.afterword = ""; publish(); return json({ afterword: "" }); }
    }
    if (!action && method === "PATCH") {
      if (!post.mine || post.visibility === "private") return notFound();
      post.expiresAt = new Date().toISOString();
      publish();
      return json({ expiresAt: post.expiresAt });
    }
    if (!action && method === "DELETE") {
      if (!post.mine) return notFound();
      state = { ...state, posts: state.posts.filter((item) => item.id !== post.id) };
      publish();
      return json({ ok: true });
    }
    return notFound();
  }

  if (method === "POST" && path === "/api/circles") {
    const name = body.name?.trim();
    if (!name) return json({ error: "name" }, 400);
    const circle: PreviewCircle = { id: id("circle"), name, description: "", inviteCode: `まねき${sequence}`, invitesEnabled: true, archived: false, managerId: PREVIEW_USER_ID, members: [{ id: PREVIEW_USER_ID, name: "わたし" }], bans: [], joined: true };
    state = { ...state, circles: [...state.circles, circle] };
    publish();
    return json({ id: circle.id, inviteCode: circle.inviteCode });
  }
  if (method === "POST" && path === "/api/circles/join") {
    const circle = state.circles.find((item) => item.inviteCode === body.inviteCode);
    if (!circle || !circle.invitesEnabled) return notFound();
    circle.joined = true;
    if (!circle.members.some((member) => member.id === PREVIEW_USER_ID)) circle.members.push({ id: PREVIEW_USER_ID, name: "わたし" });
    publish();
    return json({ id: circle.id });
  }
  if (method === "POST" && path === "/api/circles/archive") {
    const circle = findCircle(body.circleId);
    if (!circle) return notFound();
    circle.archived = body.archived === "true";
    publish();
    return json({ archived: circle.archived });
  }
  if (method === "POST" && path === "/api/circles/invites") {
    const circle = findCircle(body.circleId);
    if (!circle || circle.managerId !== PREVIEW_USER_ID) return notFound();
    if (body.action === "regenerate") {
      circle.inviteCode = `あたらしい${id("ことば")}`;
      circle.invitesEnabled = true;
    }
    if (body.action === "disable") circle.invitesEnabled = false;
    if (body.action !== "disable" && body.action !== "regenerate") return json({ error: "action" }, 400);
    publish();
    return json({ inviteCode: circle.invitesEnabled ? circle.inviteCode : null, invitesEnabled: circle.invitesEnabled });
  }
  if (method === "POST" && path === "/api/circles/leave") {
    const circle = findCircle(body.circleId);
    if (!circle) return notFound();
    const wasManager = circle.managerId === PREVIEW_USER_ID;
    if (wasManager && circle.members.some((member) => member.id !== PREVIEW_USER_ID)) return json({ error: "transfer required" }, 409);
    if (body.withdraw === "true") {
      const now = new Date().toISOString();
      state.posts.forEach((post) => {
        if (post.circleId === circle.id && post.mine && new Date(post.expiresAt).getTime() > Date.now()) post.expiresAt = now;
      });
    }
    circle.joined = false;
    circle.members = circle.members.filter((member) => member.id !== PREVIEW_USER_ID);
    if (circle.members.length === 0) circle.invitesEnabled = false;
    publish();
    return json({ ok: true });
  }
  const descriptionMatch = path.match(/^\/api\/circles\/([^/]+)\/description$/);
  if (descriptionMatch && method === "PUT") {
    const circle = findCircle(descriptionMatch[1]);
    const description = body.description;
    if (!circle || !circle.joined || circle.managerId !== PREVIEW_USER_ID) return notFound();
    if (typeof description !== "string" || description.length > 500) return json({ error: "description" }, 400);
    circle.description = description;
    publish();
    return json({ description: circle.description });
  }
  const memberMatch = path.match(/^\/api\/circles\/([^/]+)\/members$/);
  if (memberMatch && method === "POST") {
    const circle = findCircle(memberMatch[1]);
    if (!circle || circle.managerId !== PREVIEW_USER_ID) return notFound();
    const target = body.targetUserId;
    if (!target) return json({ error: "action" }, 400);
    if (body.action === "transfer") circle.managerId = target;
    if (body.action === "revoke") {
      const member = circle.members.find((item) => item.id === target);
      if (member) { circle.members = circle.members.filter((item) => item.id !== target); circle.bans.push(member); }
    }
    if (body.action === "unban") circle.bans = circle.bans.filter((item) => item.id !== target);
    if (!["transfer", "revoke", "unban"].includes(body.action)) return json({ error: "action" }, 400);
    publish();
    return json({ ok: true });
  }
  if (path.match(/^\/api\/circles\/[^/]+\/fresh$/) && method === "GET") return json({ fresh: false });
  return notFound();
}
