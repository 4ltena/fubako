import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null), signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { default: LoginPage } = await import("@/app/(auth)/login/page");

async function renderLogin() {
  return renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));
}

describe("ログイン画面の認証入口", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISCORD_ID", "");
    vi.stubEnv("EMAIL_SERVER", "");
    vi.stubEnv("PASSWORD_LOGIN", "1");
    vi.stubEnv("PUBLIC_DEMO_LOGIN", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("公開テストを明示するとユーザー名だけのフォームと注意文を表示する", async () => {
    vi.stubEnv("PUBLIC_DEMO_LOGIN", "1");
    const html = await renderLogin();
    expect(html).toContain('name="handle"');
    expect(html).toContain('action="/api/auth/password"');
    expect(html).toContain("同じ名前を知っている人は同じアカウントに入れます");
    expect(html).toContain('type="password" disabled="" aria-disabled="true"');
    expect(html).not.toContain("現在、ログインを利用できません");
  });

  it("本番で認証未設定なら案内を表示し、名前だけの入口を出さない", async () => {
    const html = await renderLogin();
    expect(html).toContain("現在、ログインを利用できません");
    expect(html).toContain("招待してくれた方、または運営者にお知らせください");
    expect(html).not.toContain('name="handle"');
    expect(html).not.toContain("/api/auth/password");
  });

  it("メール認証が有効ならメール入力を表示する", async () => {
    vi.stubEnv("EMAIL_SERVER", "smtp://mail.example.test");
    const html = await renderLogin();
    expect(html).toContain('name="email"');
    expect(html).toContain("入るためのリンクを送る");
    expect(html).not.toContain("現在、ログインを利用できません");
  });

  it("Discord認証が有効ならログインボタンを表示する", async () => {
    vi.stubEnv("AUTH_DISCORD_ID", "test-client");
    const html = await renderLogin();
    expect(html).toContain("Discord で入る");
    expect(html).not.toContain("現在、ログインを利用できません");
  });
});
