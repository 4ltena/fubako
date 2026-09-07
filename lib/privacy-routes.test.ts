import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findPost: vi.fn(),
  findImage: vi.fn(),
  isMember: vi.fn(),
  muteWordsOf: vi.fn(),
  visible: vi.fn(),
  grant: vi.fn(),
  verifyGrant: vi.fn(),
  veil: vi.fn(),
  getObject: vi.fn(),
  findReaction: vi.fn(),
  createReaction: vi.fn(),
  deleteReaction: vi.fn(),
  findMember: vi.fn(),
  lockCircle: vi.fn(),
  transaction: vi.fn(),
  createVeil: vi.fn(),
  deleteVeil: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({
  prisma: {
    post: { findUnique: mocks.findPost },
    topicMute: { findMany: vi.fn() },
    image: { findUnique: mocks.findImage },
    postVeil: { upsert: mocks.createVeil, deleteMany: mocks.deleteVeil },
    reaction: { findUnique: mocks.findReaction, create: mocks.createReaction, delete: mocks.deleteReaction },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/timeline", () => ({ isMember: mocks.isMember, muteWordsOf: mocks.muteWordsOf }));
vi.mock("@/lib/visibility", () => ({ isVisibleTo: mocks.visible }));
vi.mock("@/lib/image-grant", () => ({ issueImageGrant: mocks.grant, verifyImageGrant: mocks.verifyGrant }));
vi.mock("@/lib/veil", () => ({ veilFor: mocks.veil }));
vi.mock("@/lib/storage", () => ({ getObject: mocks.getObject }));

const post = { id: "p1", circleId: "c1", authorId: "writer", visibility: "circle", body: "本文", cw: "注意文", tags: ["推し"], expiresAt: new Date("2099-01-01"), deletedAt: null };

describe("プライバシー API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue("reader");
    mocks.isMember.mockResolvedValue(true);
    mocks.muteWordsOf.mockResolvedValue([]);
    mocks.visible.mockReturnValue(true);
    mocks.grant.mockReturnValue("grant");
    mocks.verifyGrant.mockReturnValue(false);
    mocks.veil.mockReturnValue({ veiled: false });
    mocks.getObject.mockResolvedValue(new ReadableStream());
    mocks.lockCircle.mockResolvedValue([{ id: "c1" }]);
    mocks.findMember.mockResolvedValue({ userId: "reader", circleId: "c1" });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: mocks.lockCircle,
        post: { findUnique: mocks.findPost },
        membership: { findUnique: mocks.findMember },
        reaction: { findUnique: mocks.findReaction, create: mocks.createReaction, delete: mocks.deleteReaction },
      }),
    );
  });

  it("開封だけが本文・注意文・短期画像許可を返し、許可を発行できなければ本文も返さない", async () => {
    mocks.findPost.mockResolvedValue({ ...post, images: [{ id: "i1" }] });
    const { GET } = await import("@/app/api/posts/[id]/reveal/route");
    const response = await GET(new Request("http://test/api/posts/p1/reveal"), { params: Promise.resolve({ id: "p1" }) });
    expect(await response.json()).toEqual({ body: "本文", imageIds: ["i1"], imageGrant: "grant", cw: "注意文" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");

    mocks.grant.mockReturnValue(null);
    const unavailable = await GET(new Request("http://test/api/posts/p1/reveal"), { params: Promise.resolve({ id: "p1" }) });
    expect(unavailable.status).toBe(503);
  });

  it("自分の投稿への反応は API でも拒否し、反応を作らない", async () => {
    mocks.findPost.mockResolvedValueOnce({ circleId: "c1" }).mockResolvedValueOnce({ ...post, authorId: "reader" });
    const { POST } = await import("@/app/api/posts/[id]/react/route");
    const response = await POST(new Request("http://test/api/posts/p1/react", { method: "POST" }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(404);
    expect(mocks.createReaction).not.toHaveBeenCalled();
  });

  it("箱をロック後に会員資格を読み直し、取消と競合した反応を404にする", async () => {
    const order: string[] = [];
    mocks.findPost.mockResolvedValueOnce({ circleId: "c1" }).mockImplementationOnce(async () => {
      order.push("post");
      return post;
    });
    mocks.lockCircle.mockImplementation(async () => {
      order.push("lock");
      return [{ id: "c1" }];
    });
    mocks.findMember.mockImplementation(async () => {
      order.push("membership");
      return null;
    });
    const { POST } = await import("@/app/api/posts/[id]/react/route");
    const response = await POST(new Request("http://test/api/posts/p1/react", { method: "POST" }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(404);
    expect(order).toEqual(["lock", "post", "membership"]);
    expect(mocks.createReaction).not.toHaveBeenCalled();
  });

  it("伏せた投稿の画像は同じ投稿・本人に結び付く開封許可がある場合だけ返す", async () => {
    mocks.findImage.mockResolvedValue({ id: "i1", postId: "p1", key: "images/p1/i1.webp", post: { ...post, veils: [] } });
    mocks.veil.mockReturnValue({ veiled: true, reason: "語", kind: "mute" });
    mocks.verifyGrant.mockReturnValue(true);
    const { GET } = await import("@/app/api/images/[id]/route");
    const response = await GET(new Request("http://test/api/images/i1?grant=grant"), { params: Promise.resolve({ id: "i1" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.verifyGrant).toHaveBeenCalledWith("grant", "reader", "p1");

    mocks.verifyGrant.mockReturnValue(false);
    const denied = await GET(new Request("http://test/api/images/i1"), { params: Promise.resolve({ id: "i1" }) });
    expect(denied.status).toBe(404);
  });

  it("他人のprivate投稿は開封・画像・反応・自己伏せの全経路で404にし、副作用を起こさない", async () => {
    const privatePost = { ...post, visibility: "private" as const };
    mocks.visible.mockReturnValue(false);
    mocks.findPost.mockResolvedValue({ ...privatePost, images: [{ id: "i1" }] });
    mocks.findImage.mockResolvedValue({ id: "i1", postId: "p1", key: "images/p1/i1.webp", post: { ...privatePost, veils: [] } });

    const reveal = await (await import("@/app/api/posts/[id]/reveal/route")).GET(new Request("http://test/api/posts/p1/reveal"), { params: Promise.resolve({ id: "p1" }) });
    const image = await (await import("@/app/api/images/[id]/route")).GET(new Request("http://test/api/images/i1?grant=grant"), { params: Promise.resolve({ id: "i1" }) });

    mocks.findPost.mockResolvedValueOnce({ circleId: "c1" }).mockResolvedValueOnce(privatePost);
    const react = await (await import("@/app/api/posts/[id]/react/route")).POST(new Request("http://test/api/posts/p1/react", { method: "POST" }), { params: Promise.resolve({ id: "p1" }) });
    mocks.findPost.mockResolvedValue(privatePost);
    const veil = await (await import("@/app/api/posts/[id]/veil/route")).POST(new Request("http://test/api/posts/p1/veil", { method: "POST" }), { params: Promise.resolve({ id: "p1" }) });

    expect([reveal.status, image.status, react.status, veil.status]).toEqual([404, 404, 404, 404]);
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(mocks.getObject).not.toHaveBeenCalled();
    expect(mocks.createReaction).not.toHaveBeenCalled();
    expect(mocks.createVeil).not.toHaveBeenCalled();
  });
});
