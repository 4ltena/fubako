import { beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), readBody: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/api", () => ({ requireUser: mocks.requireUser, readBody: mocks.readBody }));
vi.mock("@/lib/db", () => ({ prisma: { user: { update: mocks.update } } }));
import { POST } from "@/app/api/me/digest/route";

const request = () => new Request("http://localhost/api/me/digest", { method: "POST" });
beforeEach(() => { vi.resetAllMocks(); mocks.requireUser.mockResolvedValue("owner"); });

it("便りの停止・再開は送信された他人のIDを使わず本人だけに保存する", async () => {
  for (const enabled of ["false", "true"]) {
    mocks.readBody.mockResolvedValue({ enabled, userId: "other" });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.update).toHaveBeenLastCalledWith({ where: { id: "owner" }, data: { digestEnabled: enabled === "true" } });
  }
});

it("未認証では設定を更新しない", async () => {
  mocks.requireUser.mockResolvedValue(NextResponse.json({ error: "unauthorized" }, { status: 401 }));
  expect((await POST(request())).status).toBe(401);
  expect(mocks.update).not.toHaveBeenCalled();
});

it("壊れた入力で設定を変えない", async () => {
  for (const body of [null, {}, { enabled: "yes" }, { enabled: true }]) {
    mocks.readBody.mockResolvedValue(body);
    expect((await POST(request())).status).toBe(400);
  }
  mocks.readBody.mockRejectedValue(new SyntaxError("JSON"));
  expect((await POST(request())).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
