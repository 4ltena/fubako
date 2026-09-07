import { beforeEach, describe, expect, it, vi } from "vitest";

type State = {
  userId: string;
  circle: { id: string; inviteCode: string; invitesEnabled: boolean; memberLimit: number; createdById: string } | null;
  members: Set<string>;
  bans: Set<string>;
  events: string[];
  lockSql?: string;
  afterLookup?: () => void;
};

let state: State;

function formResponse(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

const db = vi.hoisted(() => ({ $transaction: vi.fn(), circle: { findUnique: vi.fn() }, membership: { findUnique: vi.fn() } }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/api", () => ({
  requireUser: vi.fn(async () => state.userId),
  readBody: vi.fn(async (request: Request) => (await request.json()) as Record<string, string>),
  done: vi.fn((_request: Request, _redirect: string, json: unknown) => formResponse(json)),
  fail: vi.fn((_request: Request, _redirect: string, status: number, json: unknown) => formResponse(json, status)),
}));

const joinRoute = await import("@/app/api/circles/join/route");
const inviteRoute = await import("@/app/api/circles/invites/route");
const memberRoute = await import("@/app/api/circles/[id]/members/route");
const leaveRoute = await import("@/app/api/circles/leave/route");
const archiveRoute = await import("@/app/api/circles/archive/route");

function request(path: string, body: Record<string, string>) {
  return new Request(`http://test${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function installDatabase() {
  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
      state.events.push("lock");
      state.lockSql = strings.join("?");
      return state.circle ? [{ id: state.circle.id }] : [];
    }),
    circle: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; inviteCode?: string } }) => {
        state.events.push("circle");
        if (!state.circle || (where.id && where.id !== state.circle.id) || (where.inviteCode && where.inviteCode !== state.circle.inviteCode)) return null;
        return { ...state.circle, _count: { memberships: state.members.size } };
      }),
      update: vi.fn(async ({ data }: { data: Partial<State["circle"]> }) => {
        state.events.push("circle.update");
        Object.assign(state.circle!, data);
        return state.circle;
      }),
    },
    membership: {
      findUnique: vi.fn(async ({ where }: { where: { userId_circleId: { userId: string } } }) => {
        state.events.push("membership");
        const userId = where.userId_circleId.userId;
        return state.members.has(userId) ? { userId } : null;
      }),
      create: vi.fn(async ({ data }: { data: { userId: string } }) => {
        state.events.push("membership.create");
        state.members.add(data.userId);
      }),
      delete: vi.fn(async ({ where }: { where: { userId_circleId: { userId: string } } }) => {
        state.events.push("membership.delete");
        state.members.delete(where.userId_circleId.userId);
      }),
      count: vi.fn(async () => state.members.size),
      update: vi.fn(async ({ data }: { data: { archivedAt: Date | null } }) => {
        state.events.push(data.archivedAt ? "archive" : "restore");
      }),
    },
    circleBan: {
      findUnique: vi.fn(async ({ where }: { where: { circleId_userId: { userId: string } } }) => {
        state.events.push("ban");
        const userId = where.circleId_userId.userId;
        return state.bans.has(userId) ? { userId } : null;
      }),
      upsert: vi.fn(async ({ create }: { create: { userId: string } }) => {
        state.events.push("ban.upsert");
        state.bans.add(create.userId);
      }),
      delete: vi.fn(async ({ where }: { where: { circleId_userId: { userId: string } } }) => {
        state.events.push("ban.delete");
        state.bans.delete(where.circleId_userId.userId);
      }),
    },
    post: { updateMany: vi.fn(async () => state.events.push("posts.shorten")) },
  };
  db.circle.findUnique.mockImplementation(async ({ where }: { where: { id?: string; inviteCode?: string } }) => {
    state.events.push("lookup");
    const result = state.circle && ((where.id === state.circle.id) || (where.inviteCode === state.circle.inviteCode)) ? { id: state.circle.id, createdById: state.circle.createdById } : null;
    state.afterLookup?.();
    return result;
  });
  db.membership.findUnique.mockImplementation(async ({ where }: { where: { userId_circleId: { userId: string } } }) => state.members.has(where.userId_circleId.userId) ? { userId: where.userId_circleId.userId } : null);
  db.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => {
    state.events.push("tx");
    return callback(tx);
  });
}

beforeEach(() => {
  state = { userId: "manager", circle: { id: "c1", inviteCode: "invite", invitesEnabled: true, memberLimit: 3, createdById: "manager" }, members: new Set(["manager"]), bans: new Set(), events: [] };
  vi.clearAllMocks();
  installDatabase();
});

describe("サークル API のロックと招待", () => {
  it.each([
    ["停止された招待", (s: State) => { s.circle!.invitesEnabled = false; }],
    ["ロック後に古くなった招待", (s: State) => { s.afterLookup = () => { s.circle!.inviteCode = "new-invite"; }; }],
    ["参加禁止", (s: State) => { s.bans.add("guest"); }],
    ["定員", (s: State) => { s.members = new Set(["manager", "a", "b"]); }],
  ])("%s では参加させない", async (_label, setup) => {
    state.userId = "guest";
    setup(state);
    const response = await joinRoute.POST(request("/api/circles/join", { inviteCode: "invite" }));
    expect(response.status).toBe(404);
    expect(state.members.has("guest")).toBe(false);
    expect(state.events.slice(state.events.indexOf("tx"))).toEqual(expect.arrayContaining(["tx", "lock"]));
    expect(state.events[state.events.indexOf("tx") + 1]).toBe("lock");
    expect(state.lockSql).toContain("FOR UPDATE");
  });

  it("管理者以外は招待を止められず、管理者の再発行は古い言葉を置換する", async () => {
    state.userId = "guest";
    let response = await inviteRoute.POST(request("/api/circles/invites", { circleId: "c1", action: "disable" }));
    expect(response.status).toBe(404);
    expect(state.circle!.invitesEnabled).toBe(true);
    state.userId = "manager";
    response = await inviteRoute.POST(request("/api/circles/invites", { circleId: "c1", action: "regenerate" }));
    expect(response.status).toBe(200);
    expect(state.circle!.invitesEnabled).toBe(true);
    expect(state.circle!.inviteCode).not.toBe("invite");
  });
});

describe("サークル API の管理と退出", () => {
  it("取消は禁止・会員削除・公開中投稿の引き取りを一つのロック済み処理で行う", async () => {
    state.members.add("guest");
    const response = await memberRoute.POST(request("/api/circles/c1/members", { action: "revoke", targetUserId: "guest" }), { params: Promise.resolve({ id: "c1" }) });
    expect(response.status).toBe(200);
    expect(state.bans.has("guest")).toBe(true);
    expect(state.members.has("guest")).toBe(false);
    expect(state.events).toContain("posts.shorten");
    expect(state.events[state.events.indexOf("tx") + 1]).toBe("lock");
    expect(state.lockSql).toContain("FOR UPDATE");
  });

  it("解除は投稿を戻さず、管理移譲は現在の非禁止会員だけに限る", async () => {
    state.bans.add("guest");
    let response = await memberRoute.POST(request("/api/circles/c1/members", { action: "unban", targetUserId: "guest" }), { params: Promise.resolve({ id: "c1" }) });
    expect(response.status).toBe(200);
    expect(state.events).not.toContain("posts.shorten");
    state.members.add("guest");
    state.bans.add("guest");
    response = await memberRoute.POST(request("/api/circles/c1/members", { action: "transfer", targetUserId: "guest" }), { params: Promise.resolve({ id: "c1" }) });
    expect(response.status).toBe(409);
    state.bans.delete("guest");
    response = await memberRoute.POST(request("/api/circles/c1/members", { action: "transfer", targetUserId: "guest" }), { params: Promise.resolve({ id: "c1" }) });
    expect(response.status).toBe(200);
    expect(state.circle!.createdById).toBe("guest");
  });

  it("管理者は他の会員がいるまま出られず、最後の退出は招待を停止する", async () => {
    state.members.add("guest");
    let response = await leaveRoute.POST(request("/api/circles/leave", { circleId: "c1" }));
    expect(response.status).toBe(409);
    expect(state.members.has("manager")).toBe(true);
    state.members.delete("guest");
    response = await leaveRoute.POST(request("/api/circles/leave", { circleId: "c1", withdraw: "true" }));
    expect(response.status).toBe(200);
    expect(state.members.has("manager")).toBe(false);
    expect(state.circle!.invitesEnabled).toBe(false);
    expect(state.events).toContain("posts.shorten");
  });

  it("保管は本人の所属だけを更新する", async () => {
    const response = await archiveRoute.POST(request("/api/circles/archive", { circleId: "c1", archived: "true" }));
    expect(response.status).toBe(200);
    expect(state.events).toContain("archive");
    expect(state.events).not.toContain("membership.delete");
    expect(state.events).not.toContain("posts.shorten");
  });

  it("唯一の管理者が退出した後は、作成者IDが残っていても管理APIを使えない", async () => {
    let response = await leaveRoute.POST(request("/api/circles/leave", { circleId: "c1" }));
    expect(response.status).toBe(200);
    expect(state.members.has("manager")).toBe(false);
    response = await inviteRoute.POST(request("/api/circles/invites", { circleId: "c1", action: "disable" }));
    expect(response.status).toBe(404);
    response = await memberRoute.POST(request("/api/circles/c1/members", { action: "unban", targetUserId: "guest" }), { params: Promise.resolve({ id: "c1" }) });
    expect(response.status).toBe(404);
    response = await memberRoute.GET(new Request("http://test/api/circles/c1/members"), { params: Promise.resolve({ id: "c1" }) });
    expect(response.status).toBe(404);
  });
});
