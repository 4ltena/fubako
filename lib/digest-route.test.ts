import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  users: vi.fn(),
  user: vi.fn(),
  updatePosts: vi.fn(),
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: mocks.users, findUnique: mocks.user },
    post: { updateMany: mocks.updatePosts },
  },
}));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));

describe("便りのプライバシー境界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    mocks.users.mockResolvedValue([{ id: "u1" }]);
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("反応の便りは、本人が保管していない箱の投稿だけを検索する", async () => {
    mocks.user.mockResolvedValue({ id: "u1", email: "u@example.test", memberships: [], muteRules: [], posts: [] });
    const { GET } = await import("@/app/api/cron/digest/route");
    await GET(new Request("http://test/api/cron/digest", { headers: { authorization: "Bearer cron-secret" } }));
    expect(mocks.user).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          posts: expect.objectContaining({
            where: expect.objectContaining({
              circle: { memberships: { some: { userId: "u1", archivedAt: null } } },
            }),
          }),
        }),
      }),
    );
  });

  it("送信開始の直前に停止されていれば、便りも受領印も残さない", async () => {
    mocks.user
      .mockResolvedValueOnce({
        id: "u1",
        email: "u@example.test",
        memberships: [],
        muteRules: [],
        posts: [{ id: "p1", reactionNotifiedAt: null, reactions: [{ createdAt: new Date() }] }],
      })
      .mockResolvedValueOnce({ email: "u@example.test", digestEnabled: false });
    const { GET } = await import("@/app/api/cron/digest/route");
    const response = await GET(new Request("http://test/api/cron/digest", { headers: { authorization: "Bearer cron-secret" } }));
    expect(await response.json()).toEqual({ sent: 0 });
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.updatePosts).not.toHaveBeenCalled();
  });
});
