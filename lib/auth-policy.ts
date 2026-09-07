import type { Adapter, AdapterSession } from "@auth/core/adapters";

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;
type AuthSessionData = Parameters<NonNullable<Adapter["createSession"]>>[0];
type StoredSession = AdapterSession & { authMethod?: unknown };

const HOSTED_ENVIRONMENT_KEYS = [
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_URL",
  "NETLIFY",
  "NETLIFY_DEPLOYMENT_ID",
  "AWS_LAMBDA_FUNCTION_NAME",
  "K_SERVICE",
  "RAILWAY_ENVIRONMENT",
  "RENDER",
  "FLY_APP_NAME",
  "HEROKU_APP_NAME",
  "DENO_DEPLOYMENT_ID",
  "CF_PAGES",
  "WEBSITE_SITE_NAME",
  "FUNCTIONS_WORKER_RUNTIME",
] as const;

/** `next dev` の未ホスト環境だけを、簡易入口と既存の簡易セッションに使う。 */
export function isUnhostedNextDevelopment(env: RuntimeEnvironment = process.env): boolean {
  return env.NODE_ENV === "development" && !HOSTED_ENVIRONMENT_KEYS.some((key) => Boolean(env[key]));
}

/** 簡易入口は環境ごとではなく入口ごとの明示フラグで開く。 */
export function isTemporaryLoginAllowed(kind: "password" | "dev", env: RuntimeEnvironment = process.env): boolean {
  const flag = kind === "password" ? env.PASSWORD_LOGIN : env.DEV_LOGIN;
  const publicDemo = kind === "password" && env.PUBLIC_DEMO_LOGIN === "1";
  return flag === "1" && (isUnhostedNextDevelopment(env) || publicDemo);
}

/** demo はローカル開発または明示的に有効化した公開テストだけで通す。 */
export function acceptsSessionAuthMethod(authMethod: unknown, env: RuntimeEnvironment = process.env): boolean {
  return authMethod === "verified" || (
    authMethod === "demo" &&
    (isTemporaryLoginAllowed("password", env) || isTemporaryLoginAllowed("dev", env))
  );
}

/** Auth.js adapter の通常ログインは必ず verified として発行し、読取時にも出所を確認する。 */
export function secureSessionAdapter(
  adapter: Adapter,
  createVerifiedSession: (data: AuthSessionData & { authMethod: "verified" }) => Promise<AdapterSession>,
  env: RuntimeEnvironment = process.env,
): Adapter {
  return {
    ...adapter,
    createSession: (data) => createVerifiedSession({ ...data, authMethod: "verified" }),
    getSessionAndUser: async (sessionToken) => {
      const result = await adapter.getSessionAndUser?.(sessionToken);
      if (!result || !acceptsSessionAuthMethod((result.session as StoredSession).authMethod, env)) return null;
      return result;
    },
  };
}
