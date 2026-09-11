import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  posts: vi.fn(),
  mutes: vi.fn(),
  topics: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: mocks.member },
    post: { findMany: mocks.posts },
    muteRule: { findMany: mocks.mutes },
    topicMute: { findMany: mocks.topics },
  },
}));

const future = new Date("2099-01-01T00:00:00.000Z");
const basePost = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  circleId: "c1",
  authorId: "writer",
  visibility: "circle",
  body: "楽しかった",
  cw: null,
  tags: ["推し"],
  form: "text",
  terms: [],
  createdAt: new Date("2026-09-07T00:00:00.000Z"),
  expiresAt: future,
  deletedAt: null,
  author: { name: "書いた人" },
  reactions: [],
  veils: [],
  images: [],
  afterword: "本人だけの後書き",
  ...overrides,
});

describe("タイムラインのプライバシー境界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.member.mockResolvedValue({ userId: "reader", circleId: "c1" });
    mocks.mutes.mockResolvedValue([]);
    mocks.topics.mockResolvedValue([]);
  });

  it("類似グラフに伏せ・非公開・削除・公開終了のIDを混ぜない", async () => {
    mocks.mutes.mockResolvedValue([{ word: "非表示" }]);
    const shared = { terms: ["舞台", "歌声"] };
    mocks.posts.mockResolvedValue([
      basePost({ ...shared, id: "a" }),
      basePost({ ...shared, id: "b", authorId: "another" }),
      basePost({ ...shared, id: "cw-secret", authorId: "another", cw: "注意" }),
      basePost({ ...shared, id: "mute-secret", authorId: "another", body: "非表示" }),
      basePost({ ...shared, id: "tag-secret", authorId: "another", tags: [] }),
      basePost({ ...shared, id: "self-secret", authorId: "another", veils: [{ userId: "reader" }] }),
      basePost({ ...shared, id: "private-secret", authorId: "reader", visibility: "private" }),
      basePost({ ...shared, id: "expired-secret", authorId: "another", expiresAt: new Date(0) }),
      basePost({ ...shared, id: "mine-ended", authorId: "reader", expiresAt: new Date(0) }),
      basePost({ ...shared, id: "mine-cw", authorId: "reader", cw: "注意" }),
      basePost({ ...shared, id: "mine-mute", authorId: "reader", body: "非表示" }),
      basePost({ ...shared, id: "mine-untagged", authorId: "reader", tags: [] }),
      basePost({ ...shared, id: "deleted-secret", authorId: "another", deletedAt: new Date() }),
    ]);
    const { timelineFor } = await import("./timeline");
    const posts = (await timelineFor("reader", "c1"))!;
    expect(posts.find((post) => post.id === "a")).toMatchObject({ related: [{ postId: "b", strength: 1 }] });
    for (const post of posts) {
      if (post.veiled || post.returned || post.id.startsWith("mine-")) expect(post).not.toHaveProperty("related");
      expect(post).not.toHaveProperty("terms");
    }
    expect(posts.some((post) => post.id === "private-secret")).toBe(false);
    expect(mocks.posts.mock.calls[0][0].where).toMatchObject({ circleId: "c1", visibility: "circle", deletedAt: null });
  });

  it("非会員には候補も読み込まない", async () => {
    mocks.member.mockResolvedValue(null);
    const { timelineFor } = await import("./timeline");
    expect(await timelineFor("reader", "other-circle")).toBeNull();
    expect(mocks.posts).not.toHaveBeenCalled();
  });

  it("投稿者だけに、保持された他者反応の真偽値を返す。人数・相手・時刻・後書きは返さない", async () => {
    mocks.posts.mockResolvedValue([
      basePost({ id: "mine", authorId: "reader", reactions: [{ userId: "past-member" }, { userId: "reader" }] }),
      basePost({ id: "other", reactions: [{ userId: "reader" }, { userId: "someone" }] }),
    ]);
    const { timelineFor } = await import("./timeline");
    const posts = (await timelineFor("reader", "c1"))!;
    const mine = posts.find((post) => post.id === "mine")!;
    const other = posts.find((post) => post.id === "other")!;

    expect(mine).toMatchObject({ mine: true, received: true, reacted: true });
    expect(other).toMatchObject({ mine: false, reacted: true });
    expect("received" in other).toBe(false);
    expect(Object.keys(mine)).not.toEqual(expect.arrayContaining(["reactions", "reactionCount", "afterword", "authorId"]));
    expect(JSON.stringify(posts)).not.toContain("past-member");
    expect(JSON.stringify(posts)).not.toContain("本人だけの後書き");
  });
});

describe("箱ごとの話題伏せ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutes.mockResolvedValue([{ word: "共通語" }]);
    mocks.topics.mockResolvedValue([{ word: "この箱だけ" }]);
  });

  it("継続的な非表示語へ指定した箱の語だけを加える", async () => {
    const { muteWordsOf } = await import("./timeline");
    await expect(muteWordsOf("reader", "c1")).resolves.toEqual(["共通語", "この箱だけ"]);
    await expect(muteWordsOf("reader", "c2")).resolves.toEqual(["共通語", "この箱だけ"]);
    expect(mocks.topics).toHaveBeenNthCalledWith(1, { where: { userId: "reader", circleId: "c1" }, select: { word: true } });
    expect(mocks.topics).toHaveBeenNthCalledWith(2, { where: { userId: "reader", circleId: "c2" }, select: { word: true } });
  });
});

describe("候補タグのプライバシー境界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutes.mockResolvedValue([{ word: "ネタバレ" }]);
  });

  it("伏せられる投稿のタグを候補に混ぜず、他人の登録語も必要としない", async () => {
    mocks.posts.mockResolvedValue([
      basePost({ id: "hidden", body: "ネタバレの感想", tags: ["隠すタグ"] }),
      basePost({ id: "shown", body: "楽しかった", tags: ["見えるタグ"] }),
    ]);
    const { suggestedTags } = await import("./tags");
    await expect(suggestedTags("c1", "reader")).resolves.toEqual(["見えるタグ"]);
    expect(mocks.mutes).toHaveBeenCalledWith({ where: { userId: "reader" }, select: { word: true } });
  });
});
