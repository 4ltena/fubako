import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), member: vi.fn(), mutes: vi.fn(), posts: vi.fn(), veil: vi.fn() }));
vi.mock("@/lib/api", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/timeline", () => ({ isMember: mocks.member, muteWordsOf: mocks.mutes }));
vi.mock("@/lib/db", () => ({ prisma: { post: { findMany: mocks.posts } } }));
vi.mock("@/lib/veil", () => ({ veilFor: mocks.veil }));

const request = () => new Request("http://test/api/circles/c1/fresh?since=2026-09-07T00:00:00.000Z");
const params = { params: Promise.resolve({ id: "c1" }) };
const post = { body: "本文", cw: null, tags: ["話題"], veils: [] };

describe("新着の伏せ境界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue("reader");
    mocks.member.mockResolvedValue(true);
    mocks.mutes.mockResolvedValue(["話題"]);
    mocks.posts.mockResolvedValue([]);
    mocks.veil.mockReturnValue({ veiled: false });
  });

  it("候補が空なら新着なしにする", async () => {
    const { GET } = await import("@/app/api/circles/[id]/fresh/route");
    expect(await (await GET(request(), params)).json()).toEqual({ fresh: false });
  });

  it("話題伏せまたは自己伏せだけなら知らせない", async () => {
    mocks.posts.mockResolvedValue([{ ...post, veils: [{ userId: "reader" }] }]);
    mocks.veil.mockReturnValue({ veiled: true, reason: "話題", kind: "mute" });
    const { GET } = await import("@/app/api/circles/[id]/fresh/route");
    expect(await (await GET(request(), params)).json()).toEqual({ fresh: false });
    expect(mocks.mutes).toHaveBeenCalledWith("reader", "c1");
  });

  it("見えてよい投稿だけを新着として返し、private をDB候補から除く", async () => {
    mocks.posts.mockResolvedValue([post]);
    const { GET } = await import("@/app/api/circles/[id]/fresh/route");
    expect(await (await GET(request(), params)).json()).toEqual({ fresh: true });
    expect(mocks.posts).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ circleId: "c1", visibility: "circle" }) }));
  });

  it("会員でなければ投稿検索をせず404にする", async () => {
    mocks.member.mockResolvedValue(false);
    const { GET } = await import("@/app/api/circles/[id]/fresh/route");
    const response = await GET(request(), params);
    expect(response.status).toBe(404);
    expect(mocks.posts).not.toHaveBeenCalled();
  });
});
