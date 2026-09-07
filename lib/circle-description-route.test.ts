import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

type State = { userId: string | null; circle: { id: string; createdById: string; description: string } | null; members: Set<string>; lockSql?: string; events: string[] };
let state: State;

const db = vi.hoisted(() => ({ $transaction: vi.fn(), circle: { findUnique: vi.fn() }, membership: { findUnique: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/api", () => ({ requireUser: vi.fn(async () => state.userId ?? NextResponse.json({ error: "unauthorized" }, { status: 401 })) }));

const route = await import("@/app/api/circles/[id]/description/route");
const context = { params: Promise.resolve({ id: "c1" }) };
const request = (method: "GET" | "PUT", body?: unknown) => new Request("http://test/api/circles/c1/description", { method, headers: body === undefined ? undefined : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

function installDatabase() {
  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      state.events.push("lock");
      state.lockSql = strings.join("?");
      return state.circle ? [{ id: state.circle.id }] : [];
    }),
    circle: {
      findUnique: vi.fn(async () => state.circle && { createdById: state.circle.createdById }),
      update: vi.fn(async ({ data }: { data: { description: string } }) => {
        state.events.push("update");
        state.circle!.description = data.description;
      }),
    },
    membership: { findUnique: vi.fn(async ({ where }: { where: { userId_circleId: { userId: string } } }) => state.members.has(where.userId_circleId.userId) ? { userId: where.userId_circleId.userId } : null) },
  };
  db.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  db.membership.findUnique.mockImplementation(async ({ where }: { where: { userId_circleId: { userId: string } } }) => state.members.has(where.userId_circleId.userId) ? { userId: where.userId_circleId.userId } : null);
  db.circle.findUnique.mockImplementation(async () => state.circle && { description: state.circle.description });
}

beforeEach(() => {
  state = { userId: "manager", circle: { id: "c1", createdById: "manager", description: "見終えてから感想を" }, members: new Set(["manager", "member"]), events: [] };
  vi.clearAllMocks();
  installDatabase();
});

describe("箱の説明 API", () => {
  it("認証済みの会員だけが説明を読む", async () => {
    let response = await route.GET(request("GET"), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ description: "見終えてから感想を" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");

    state.userId = "outsider";
    response = await route.GET(request("GET"), context);
    expect(response.status).toBe(404);
    state.userId = null;
    response = await route.GET(request("GET"), context);
    expect(response.status).toBe(401);
  });

  it("管理者かつ会員だけが、ロック後の資格確認を通って更新できる", async () => {
    let response = await route.PUT(request("PUT", { description: "作品を見終えてから開いてください。" }), context);
    expect(response.status).toBe(200);
    expect(state.circle!.description).toBe("作品を見終えてから開いてください。");
    expect(state.events).toEqual(["lock", "update"]);
    expect(state.lockSql).toContain("FOR UPDATE");

    state.userId = "member";
    response = await route.PUT(request("PUT", { description: "書き換え" }), context);
    expect(response.status).toBe(404);
    expect(state.circle!.description).toBe("作品を見終えてから開いてください。");

    state.userId = "manager";
    state.members.delete("manager");
    response = await route.PUT(request("PUT", { description: "書き換え" }), context);
    expect(response.status).toBe(404);
  });

  it("空文字を保存でき、形式違いと長すぎる内容を拒否する", async () => {
    let response = await route.PUT(request("PUT", { description: "" }), context);
    expect(response.status).toBe(200);
    expect(state.circle!.description).toBe("");
    response = await route.PUT(request("PUT", { description: "あ".repeat(501) }), context);
    expect(response.status).toBe(400);
    response = await route.PUT(new Request("http://test/api/circles/c1/description", { method: "PUT", headers: { "content-type": "application/json" }, body: "{" }), context);
    expect(response.status).toBe(400);
  });
});
