const PLACEHOLDER = /^(?:change[-_ ]?me|example|placeholder|secret|test|undefined|null|your[-_ ]?(?:secret|token|value)|[x*]+)$/i;
const TARGETS = new Set(["vercel", "docker"]);

function value(env, key) {
  const raw = env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function isStrongSecret(raw) {
  return raw.length >= 32 && !PLACEHOLDER.test(raw);
}

function validPostgresUrl(raw) {
  try {
    const url = new URL(raw);
    return (url.protocol === "postgres:" || url.protocol === "postgresql:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validHttpsOrigin(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function validEmailFrom(raw) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

function validSmtpUrl(raw) {
  try {
    const url = new URL(raw);
    return (url.protocol === "smtp:" || url.protocol === "smtps:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * 本番用の環境値だけを検査する。値を返さず、接続や外部API呼出しもしない。
 */
export function validateDeployEnvironment(env = process.env, options = {}) {
  const errors = [];
  const target = options.target ?? value(env, "DEPLOY_TARGET");
  if (!TARGETS.has(target)) {
    errors.push("DEPLOY_TARGET は vercel または docker を明示してください");
  }

  if (!validPostgresUrl(value(env, "DATABASE_URL"))) {
    errors.push("DATABASE_URL に PostgreSQL 接続URLが必要です");
  }
  const unpooled = value(env, "DATABASE_URL_UNPOOLED");
  if (unpooled && !validPostgresUrl(unpooled)) {
    errors.push("DATABASE_URL_UNPOOLED は PostgreSQL 接続URLにしてください");
  }
  if (!isStrongSecret(value(env, "AUTH_SECRET"))) {
    errors.push("AUTH_SECRET は32文字以上の推測できない値にしてください");
  }
  if (!validHttpsOrigin(value(env, "APP_URL"))) {
    errors.push("APP_URL はパスを含まない HTTPS の公開URLにしてください");
  }

  const discordId = value(env, "AUTH_DISCORD_ID");
  const discordSecret = value(env, "AUTH_DISCORD_SECRET");
  if (Boolean(discordId) !== Boolean(discordSecret)) {
    errors.push("Discord 認証は AUTH_DISCORD_ID と AUTH_DISCORD_SECRET を対で設定してください");
  }
  const smtp = value(env, "EMAIL_SERVER");
  const from = value(env, "EMAIL_FROM");
  if (Boolean(smtp) !== Boolean(from)) {
    errors.push("メール認証は EMAIL_SERVER と EMAIL_FROM を対で設定してください");
  }
  if (smtp && !validSmtpUrl(smtp)) {
    errors.push("EMAIL_SERVER は smtp:// または smtps:// の接続URLにしてください");
  }
  if (from && !validEmailFrom(from)) {
    errors.push("EMAIL_FROM は送信元メールアドレスにしてください");
  }
  if (!(discordId && discordSecret) && !(smtp && from && validSmtpUrl(smtp) && validEmailFrom(from))) {
    errors.push("Discord 認証またはメール認証を完全な組で設定してください");
  }

  if (target === "vercel") {
    if (!(smtp && from && validSmtpUrl(smtp) && validEmailFrom(from))) {
      errors.push("vercel.json の定期実行には EMAIL_SERVER と EMAIL_FROM が必要です");
    }
    if (!isStrongSecret(value(env, "CRON_SECRET"))) {
      errors.push("vercel.json の定期実行には32文字以上の CRON_SECRET が必要です");
    }
  }

  if (target === "vercel" && !isStrongSecret(value(env, "BLOB_READ_WRITE_TOKEN"))) {
    errors.push("Vercel では BLOB_READ_WRITE_TOKEN を設定してください");
  }
  if (target === "docker" && !isStrongSecret(value(env, "BLOB_READ_WRITE_TOKEN")) && value(env, "LOCAL_IMAGE_STORAGE_PATH") !== ".data") {
    errors.push("Docker で Blob を使わない場合は永続ボリュームを .data にマウントし、LOCAL_IMAGE_STORAGE_PATH=.data を明示してください");
  }

  return { ok: errors.length === 0, errors };
}

function parseArgs(args) {
  let target;
  for (const arg of args) {
    if (arg.startsWith("--target=")) target = arg.slice("--target=".length);
    else throw new Error("使い方: node scripts/check-deploy-env.mjs [--target=vercel|docker]");
  }
  return { target };
}

if (import.meta.main) {
  let result;
  try {
    result = validateDeployEnvironment(process.env, parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    process.exitCode = 1;
  }
  if (result) {
    if (result.ok) console.log("環境値の検査に成功しました");
    else {
      for (const error of result.errors) console.error(error);
      process.exitCode = 1;
    }
  }
}
