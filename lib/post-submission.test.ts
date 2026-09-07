import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn(), membership: { findUnique: vi.fn() }, post: { findUnique: vi.fn(), create: vi.fn() } };
  return { tx, prisma: { $transaction: vi.fn(), post: { findMany: vi.fn(), findUnique: vi.fn() } }, put: vi.fn(), remove: vi.fn(), member: vi.fn(), requireUser: vi.fn() };
});
vi.mock("@/lib/db", () => ({ prisma: state.prisma }));
vi.mock("@/lib/api", () => ({ requireUser: state.requireUser, done: (_req: Request, _to: string, value: unknown) => Response.json(value) }));
vi.mock("@/lib/timeline", () => ({ isMember: state.member, timelineFor: vi.fn() }));
vi.mock("@/lib/storage", () => ({ putObject: state.put, deleteObject: state.remove }));
vi.mock("@/lib/similar", () => ({ extractTerms: vi.fn().mockResolvedValue([]), RECENT_BODIES: 3 }));
vi.mock("@/lib/image", () => ({ ACCEPTED_TYPES: new Set(["image/png"]), processImage: vi.fn().mockResolvedValue({ webp: Buffer.from("image"), blurhash: "hash", width: 10, height: 10 }) }));
import { POST } from "../app/api/posts/route";

const requestId = "submission-request-001";
function request(body = "感想", image = true, tags = "", visibility?: "circle" | "private") {
  const form = new FormData();
  form.set("circleId", "circle"); form.set("body", body); form.set("clientRequestId", requestId);
  form.set("tags", tags);
  if (visibility) form.set("visibility", visibility);
  if (image) form.append("images", new Blob(["image-data"], { type: "image/png" }), "photo.png");
  return new Request("http://localhost/api/posts", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.requireUser.mockResolvedValue("author");
  state.member.mockResolvedValue(true);
  state.tx.membership.findUnique.mockResolvedValue({ userId: "author" });
  state.tx.post.findUnique.mockResolvedValue(null);
  state.tx.post.create.mockImplementation(async ({ data }: { data: { id: string; visibility: "circle" | "private" } }) => ({ id: data.id, visibility: data.visibility }));
  state.prisma.post.findMany.mockResolvedValue([]);
  state.prisma.post.findUnique.mockResolvedValue(null);
  state.prisma.$transaction.mockImplementation(async (fn: (tx: typeof state.tx) => Promise<unknown>) => fn(state.tx));
  state.put.mockResolvedValue(undefined); state.remove.mockResolvedValue(undefined);
});

describe("投稿の保存と再試行", () => {
  it("保存前に箱と送信識別子をロックし、画像を含む投稿を一度に作る", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: expect.any(String) });
    expect(state.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(state.tx.membership.findUnique.mock.invocationCallOrder[0]);
    expect(state.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(state.put.mock.invocationCallOrder[0]);
    expect(state.put.mock.invocationCallOrder[0]).toBeLessThan(state.tx.post.create.mock.invocationCallOrder[0]);
    expect(state.tx.post.create.mock.calls[0][0].data.images.create).toHaveLength(1);
  });
  it("同じ送信の再試行は画像も本文も重複保存しない", async () => {
    const first = await (await POST(request())).json();
    const saved = state.tx.post.create.mock.calls[0][0].data;
    state.tx.post.findUnique.mockResolvedValue({ id: saved.id, requestHash: saved.requestHash, deletedAt: null });
    const second = await (await POST(request())).json();
    expect(second).toEqual(first);
    expect(state.put).toHaveBeenCalledTimes(1);
    expect(state.tx.post.create).toHaveBeenCalledTimes(1);
  });
  it("同じ識別子の異なる本文は409になり、勝者の画像を触らない", async () => {
    await POST(request());
    const saved = state.tx.post.create.mock.calls[0][0].data;
    state.tx.post.findUnique.mockResolvedValue({ id: saved.id, requestHash: saved.requestHash, deletedAt: null });
    expect((await POST(request("別の感想"))).status).toBe(409);
    expect(state.put).toHaveBeenCalledTimes(1);
    expect(state.remove).not.toHaveBeenCalled();
  });
  it("タグの表記ゆれだけなら同じ送信として扱う", async () => {
    const first = await (await POST(request("感想", false, "ｶﾀｶﾅ ＡＢＣ"))).json();
    const saved = state.tx.post.create.mock.calls[0][0].data;
    state.tx.post.findUnique.mockResolvedValue({ id: saved.id, requestHash: saved.requestHash, deletedAt: null });
    expect(await (await POST(request("感想", false, "abc カタカナ かたかな"))).json()).toEqual(first);
    expect(state.tx.post.create).toHaveBeenCalledTimes(1);
  });
  it("保存先は送信識別子の内容に含め、private は自己記録へ戻す", async () => {
    const privateResponse = await POST(request("感想", false, "", "private"));
    expect(await privateResponse.json()).toEqual({ id: expect.any(String), redirectTo: "/archive" });
    const saved = state.tx.post.create.mock.calls[0][0].data;
    expect(saved.visibility).toBe("private");
    state.tx.post.findUnique.mockResolvedValue({ id: saved.id, requestHash: saved.requestHash, deletedAt: null, visibility: "private" });
    expect((await POST(request("感想", false, "", "circle"))).status).toBe(409);
  });
  it("送信識別子の省略・空値を保存前に拒否する", async () => {
    for (const clientRequestId of [undefined, "", "short"]) {
      const req = new Request("http://localhost/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ circleId: "circle", body: "感想", clientRequestId }) });
      expect((await POST(req)).status).toBe(400);
    }
    expect(state.prisma.$transaction).not.toHaveBeenCalled();
    expect(state.put).not.toHaveBeenCalled();
  });
  it("参加取消後はロック内の会員再確認で止める", async () => {
    state.tx.membership.findUnique.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(state.put).not.toHaveBeenCalled();
    expect(state.tx.post.create).not.toHaveBeenCalled();
  });
  it("保存失敗でDBに残っていないと確認できた画像だけを回収する", async () => {
    state.put.mockRejectedValue(new Error("storage failure"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(request())).status).toBe(502);
    expect(state.tx.post.create).not.toHaveBeenCalled();
    expect(state.remove).toHaveBeenCalledWith(state.put.mock.calls[0][0]);
    log.mockRestore();
  });
  it("commit後の通信断では、残った投稿を確認して成功を返し画像を消さない", async () => {
    state.prisma.$transaction.mockImplementation(async (fn: (tx: typeof state.tx) => Promise<unknown>) => {
      await fn(state.tx);
      state.prisma.post.findUnique.mockResolvedValue({ id: state.tx.post.create.mock.calls[0][0].data.id, deletedAt: null });
      throw new Error("commit response lost");
    });
    expect((await POST(request())).status).toBe(200);
    expect(state.remove).not.toHaveBeenCalled();
  });
  it("保存結果が不明な場合も、保存済みかもしれない画像は消さない", async () => {
    state.prisma.$transaction.mockImplementation(async (fn: (tx: typeof state.tx) => Promise<unknown>) => { await fn(state.tx); throw new Error("connection lost"); });
    state.prisma.post.findUnique.mockRejectedValue(new Error("database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(request())).status).toBe(502);
    expect(state.remove).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("壊れたJSONや型違いでは500にせず400を返す", async () => {
    for (const body of ["{", "null", "[]", '{"body":15}']) {
      const res = await POST(new Request("http://localhost/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body }));
      expect(res.status).toBe(400);
    }
    expect(state.put).not.toHaveBeenCalled();
  });
});
