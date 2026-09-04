# ふばこを Vercel 以外（Render / Fly.io / VPS）でも動かすためのイメージ。
#
# 動かし方:
#   docker build -t fubako .
#   docker run --rm -e DATABASE_URL=... -e AUTH_SECRET=... -p 3000:3000 fubako
#   docker run --rm fubako node scripts/verify-tokenizer.mjs   # 形態素解析だけ確かめる
#   docker run --rm -e CRON_SECRET=... -e APP_URL=... fubako node scripts/cron.mjs  # ダイジェスト

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:24-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/lib/generated ./lib/generated
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY scripts ./scripts
COPY lib/morph.ts lib/similar.ts ./lib/
EXPOSE 3000
CMD ["npm", "start"]
