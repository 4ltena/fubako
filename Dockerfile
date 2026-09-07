# ふばこを Vercel 以外（Render / Fly.io / VPS）でも動かすためのイメージ。
#
# 動かし方は docs/deployment.md を参照する。移行はアプリを起動する前に実行する。

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
# `cron` とDB移行は本番依存だけで実行する。移行テスト用の依存は runner に含めない。
EXPOSE 3000
CMD ["npm", "start"]
