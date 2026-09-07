import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn() },
  session: { findUnique: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/api", () => ({ sessionCookieName: () => "authjs.session-token" }));

const passwordRoute = await import("@/app/api/auth/password/route");
const devRoute = await import("@/app/api/dev/login/route");

function setEnv(values: Record<string, string | undefined>) {
  const keys = ["NODE_ENV", "PASSWORD_LOGIN", "DEV_LOGIN", "VERCEL_ENV", "VERCEL", "NETLIFY"] as const;
  for (const key of keys) {
    vi.stubEnv(key, values[key]);
  }
  return () => vi.unstubAllEnvs();
}

describe("簡易ログインRouteの早期拒否", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it("パスワード入口は本番でDBへ触れない", async () => {
    const restore = setEnv({ NODE_ENV: "production", PASSWORD_LOGIN: "1" });
    try {
      const response = await passwordRoute.POST(new Request("https://fubako.example/api/auth/password", { method: "POST", body: new URLSearchParams({ handle: "rin" }) }));
      expect(response.status).toBe(404);
      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(db.user.create).not.toHaveBeenCalled();
      expect(db.session.create).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("開発フラグがあってもホスト環境ではパスワード入口がDBへ触れない", async () => {
    const restore = setEnv({ NODE_ENV: "development", PASSWORD_LOGIN: "1", VERCEL_ENV: "preview" });
    try {
      const response = await passwordRoute.POST(new Request("https://fubako.example/api/auth/password", { method: "POST", body: new URLSearchParams({ handle: "rin" }) }));
      expect(response.status).toBe(404);
      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(db.user.create).not.toHaveBeenCalled();
      expect(db.session.create).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("開発ログイン入口は本番でDBへ触れない", async () => {
    const restore = setEnv({ NODE_ENV: "production", DEV_LOGIN: "1" });
    try {
      const response = await devRoute.GET(new Request("https://fubako.example/api/dev/login?token=demo"));
      expect(response.status).toBe(404);
      expect(db.session.findUnique).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("許可済みの名前だけログインは demo セッションを明示して発行する", async () => {
    const restore = setEnv({ NODE_ENV: "development", PASSWORD_LOGIN: "1" });
    db.user.findUnique.mockResolvedValue({ id: "u1" });
    db.session.create.mockImplementation(async ({ data }) => data);
    try {
      const response = await passwordRoute.POST(new Request("http://localhost:3000/api/auth/password", { method: "POST", body: new URLSearchParams({ handle: "rin" }) }));
      expect(response.status).toBe(303);
      expect(db.session.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ userId: "u1", authMethod: "demo" }),
      }));
    } finally {
      restore();
    }
  });

  it("開発リンクは demo として発行されたセッションだけを受け付ける", async () => {
    const restore = setEnv({ NODE_ENV: "development", DEV_LOGIN: "1" });
    db.session.findUnique.mockResolvedValue({ sessionToken: "verified", authMethod: "verified", expires: new Date("2099-01-01T00:00:00.000Z") });
    try {
      const response = await devRoute.GET(new Request("http://localhost:3000/api/dev/login?token=verified"));
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login?dev=stale");
    } finally {
      restore();
    }
  });
});
