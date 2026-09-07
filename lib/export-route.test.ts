import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/api", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({ prisma: { post: { findMany: mocks.findMany } } }));
import { GET } from "@/app/api/me/export/route";

const request = (month = "2026-08") => new Request(`http://localhost/api/me/export?month=${month}`);
const record = (id: string) => ({
  id, body: "公開していない感想 <script>そのままの文字</script>", cw: "終盤の話", tags: ["新曲"], afterword: "自分の後書き",
  createdAt: new Date("2026-07-31T15:00:00Z"), expiresAt: new Date("2099-01-01"), visibility: "private" as const,
  imageKey: "secret-image-key", reactions: [{ userId: "someone-else" }], normalizedWord: "secret-mute",
});

describe("本人の月別テキスト書き出し", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue("me"); mocks.findMany.mockResolvedValue([]); });
  it("認証前と不正な年月ではDBを読まない", async () => {
    mocks.requireUser.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    expect((await GET(request())).status).toBe(401);
    mocks.requireUser.mockResolvedValue("me");
    for (const month of ["2026-13", "0000-01", "invalid"]) expect((await GET(request(month))).status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("本人かつ削除前かつJST月内を絞り、privateと後書きを含み、関連情報を含めない", async () => {
    mocks.findMany.mockResolvedValue([record("p1")]);
    const response = await GET(request());
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toContain("fubako-2026-08.txt");
    const body = await response.text();
    expect(body).toContain("2026-08-01 00:00");
    expect(body).toContain("自分だけに表示");
    expect(body).toContain("自分の後書き");
    expect(body).not.toMatch(/secret-image-key|someone-else|secret-mute/);
    const args = mocks.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ authorId: "me", deletedAt: null, createdAt: { gte: new Date("2026-07-31T15:00:00Z"), lt: new Date("2026-08-31T15:00:00Z"), lte: expect.any(Date) } });
    expect(args.select).not.toHaveProperty("images");
    expect(args.select).not.toHaveProperty("reactions");
  });
  it("100件を超えても日時とIDでページ送りし、全件を一度ずつ出す", async () => {
    mocks.findMany.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => record(`p${i}`))).mockResolvedValueOnce([{ ...record("last"), body: "最後の記録" }]);
    const text = await (await GET(request())).text();
    expect(text.match(/公開していない感想/g)).toHaveLength(100);
    expect(text).toContain("最後の記録");
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.findMany.mock.calls[1][0].where.OR[1]).toEqual({ createdAt: record("p99").createdAt, id: { lt: "p99" } });
    expect(mocks.findMany.mock.calls[0][0].where.createdAt.lte).toEqual(mocks.findMany.mock.calls[1][0].where.createdAt.lte);
  });
  it("DB障害と途中のストリーム障害を正常完了として渡さない", async () => {
    mocks.findMany.mockRejectedValueOnce(new Error("db"));
    expect((await GET(request())).status).toBe(503);
    mocks.findMany.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => record(`p${i}`))).mockRejectedValueOnce(new Error("interrupted"));
    const response = await GET(request());
    await expect(response.blob()).rejects.toThrow("書き出しを完了できませんでした。");
  });
});
