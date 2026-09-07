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
