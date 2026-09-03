# ふばこを Vercel 以外（Render / Fly.io / VPS）でも動かすためのイメージ。
# MeCab はネイティブバイナリと辞書が要るので、Node が常駐できる環境を前提にする。
#
# 動かし方:
#   docker build -t fubako .
#   docker run --rm -e DATABASE_URL=... -e AUTH_SECRET=... -p 3000:3000 fubako
#   docker run --rm fubako node scripts/verify-mecab.mjs   # 形態素解析だけ確かめる
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
# mecab: 本体 / libmecab-dev: mecab-dict-index（ユーザー辞書の作成） / ipadic-utf8: 既定辞書
RUN apt-get update \
  && apt-get install -y --no-install-recommends mecab libmecab-dev mecab-ipadic-utf8 \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV MECAB_DICDIR=/var/lib/mecab/dic/ipadic-utf8
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
