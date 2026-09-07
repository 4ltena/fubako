import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  readBody: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ requireUser: mocks.requireUser, readBody: mocks.readBody }));
vi.mock("@/lib/db", () => ({ prisma: { post: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } } }));

import { DELETE, GET, PUT } from "@/app/api/posts/[id]/afterword/route";

const ctx = { params: Promise.resolve({ id: "post-1" }) };
const request = () => new Request("http://localhost/api/posts/post-1/afterword", { method: "PUT" });

describe("後書き API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("本人だけが後書きを読む", async () => {
    mocks.requireUser.mockResolvedValue("author");
    mocks.findFirst.mockResolvedValue({ afterword: "あとからの記録" });
    const response = await GET(request(), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ afterword: "あとからの記録" });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "post-1", authorId: "author", deletedAt: null },
      select: { afterword: true },
    });
  });

  it("他人、管理者アカウント、削除済みの紙は同じ 404 にする", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.updateMany.mockResolvedValue({ count: 0 });
    for (const userId of ["other", "administrator"]) {
      mocks.requireUser.mockResolvedValue(userId);
      expect((await GET(request(), ctx)).status).toBe(404);
      mocks.readBody.mockResolvedValue({ afterword: "読めない" });
      expect((await PUT(request(), ctx)).status).toBe(404);
      expect((await DELETE(request(), ctx)).status).toBe(404);
    }
    mocks.requireUser.mockResolvedValue("author");
    expect((await GET(request(), ctx)).status).toBe(404);
    mocks.readBody.mockResolvedValue({ afterword: "削除済み" });
    expect((await PUT(request(), ctx)).status).toBe(404);
    expect((await DELETE(request(), ctx)).status).toBe(404);
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: { id: "post-1", authorId: "author", deletedAt: null },
      data: { afterword: "" },
    });
  });

  it("後書きだけを更新し、本文・作成日時・期限には触れない", async () => {
    mocks.requireUser.mockResolvedValue("author");
    mocks.readBody.mockResolvedValue({ afterword: "今日の追記" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const response = await PUT(request(), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ afterword: "今日の追記" });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "post-1", authorId: "author", deletedAt: null },
      data: { afterword: "今日の追記" },
    });
  });

  it("長すぎる値は書き込まない", async () => {
    mocks.requireUser.mockResolvedValue("author");
    mocks.readBody.mockResolvedValue({ afterword: "あ".repeat(4001) });
    const response = await PUT(request(), ctx);
    expect(response.status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
