import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), done: vi.fn((_req: Request, _to: string, value: unknown) => Response.json(value)),
  lock: vi.fn(), findMember: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), transaction: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ requireUser: mocks.requireUser, readBody: async (req: Request) => req.json(), done: mocks.done }));
vi.mock("@/lib/circles", () => ({ lockCircle: mocks.lock }));
vi.mock("@/lib/db", () => ({
  prisma: {
    topicMute: { findMany: mocks.findMany, deleteMany: mocks.deleteMany },
    $transaction: mocks.transaction,
  },
}));

describe("箱ごとの話題伏せ API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue("me");
    mocks.lock.mockResolvedValue([{ id: "c1" }]);
    mocks.findMember.mockResolvedValue({ userId: "me" });
    mocks.upsert.mockResolvedValue({ id: "rule", circleId: "c1", word: "ネタバレ" });
    mocks.transaction.mockImplementation((fn) => fn({ membership: { findUnique: mocks.findMember }, topicMute: { upsert: mocks.upsert } }));
  });

  it("一覧は退出後も本人の語だけを返す", async () => {
    mocks.findMany.mockResolvedValue([{ id: "rule", circleId: "left", word: "未視聴" }]);
    const { GET } = await import("@/app/api/me/topic-mutes/route");
    const response = await GET(new Request("http://test/api/me/topic-mutes"));
    expect(await response.json()).toEqual({ rules: [{ id: "rule", circleId: "left", word: "未視聴" }] });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "me" } }));
  });

  it("追加は箱をロックして会員を確かめ、表記ゆれで重複させない", async () => {
    const { POST } = await import("@/app/api/me/topic-mutes/route");
    const response = await POST(new Request("http://test/api/me/topic-mutes", { method: "POST", body: JSON.stringify({ circleId: "c1", word: " ＡＢＣ " }) }));
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_circleId_normalizedWord: { userId: "me", circleId: "c1", normalizedWord: "abc" } } }));
  });

  it("壊れたJSONは保存処理へ進めず400にする", async () => {
    const { POST } = await import("@/app/api/me/topic-mutes/route");
    const response = await POST(new Request("http://test/api/me/topic-mutes", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }));
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("削除は退出後も本人・箱・IDの三つで限定する", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    const { DELETE } = await import("@/app/api/me/topic-mutes/route");
    await DELETE(new Request("http://test/api/me/topic-mutes?circleId=left&id=rule", { method: "DELETE" }));
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "rule", circleId: "left", userId: "me" } });
  });
});
