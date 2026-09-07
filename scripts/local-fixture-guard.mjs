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
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isHostedEnvironment(env = process.env) {
  return HOSTED_ENVIRONMENT_KEYS.some((key) => Boolean(env[key]));
}

export function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function isLoopbackDatabaseUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "postgres:" || url.protocol === "postgresql:") && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function assertLocalFixtureEnvironment(env = process.env, { appUrl } = {}) {
  if (env.NODE_ENV !== "development") {
    throw new Error("開発用フィクスチャは NODE_ENV=development のときだけ実行できます");
  }
  if (env.DEV_LOGIN !== "1" && env.PASSWORD_LOGIN !== "1") {
    throw new Error("開発用フィクスチャには DEV_LOGIN=1 または PASSWORD_LOGIN=1 が必要です");
  }
  if (isHostedEnvironment(env)) {
    throw new Error("ホスト環境では開発用フィクスチャを実行できません");
  }
  if (!isLoopbackDatabaseUrl(env.DATABASE_URL)) {
    throw new Error("開発用フィクスチャはループバックの DATABASE_URL だけを使用できます");
  }
  if (appUrl !== undefined && !isLoopbackUrl(appUrl)) {
    throw new Error("開発用スモークはループバックの APP_URL だけを使用できます");
  }
}
