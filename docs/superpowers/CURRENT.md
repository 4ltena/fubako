# ふばこ 現在地

更新: 2026-09-02

## 状態

企画書（`docs/superpowers/企画書.md`）の段階 1〜4 を一度に実装した。段階 5（Anthropic API によるタグ自動推定）は未着手。

- 実装済み: サークル（招待コード・定員30）、投稿（寿命既定7日・短縮のみ）、タイムライン、地雷宣言と伏せ（サーバ側で本文を落とす）、未タグは未確認で伏せる、反応1種（数は出さない）、アーカイブ（本人には期限切れも残る）、日次ダイジェスト（`/api/cron/digest`、Vercel Cron 12:00 UTC = 21:00 JST）、robots/noindex/OGP 無し、PWA manifest
- 認証: Auth.js v5、Discord（`AUTH_DISCORD_ID` が無ければボタン非表示）＋メールのマジックリンク（nodemailer）
- DB: Prisma 7 + `@prisma/adapter-pg`。ローカルは `npm run db:dev`（`prisma dev`、Docker 不要）

## 検証

- `npm test` 13件 pass（veil / visibility）
- `npm run typecheck`・`npm run lint` エラー無し
- `npm run build` 成功
- `npm run smoke` 27項目 ALL OK（本番ビルドを `next start` して API を通しで確認）
- `npm run seed` で仮ユーザー5人（*@example.test）とサークル・投稿・地雷宣言を投入し、りん視点で「ネタバレ」「愚痴」が伏せられ期限切れが消えることを API で確認
- 未検証: マジックリンクのメール送信、Discord OAuth、ダイジェストの実送信（ローカルに SMTP が無い）

## 次の作業

1. Vercel + Neon に置いて、実 SMTP と Discord で認証を通す
2. 段階 0 のヒアリング結果を待って、段階 5（タグ自動推定）へ進むか決める
3. 未決: 人数上限・寿命既定値・画像・名前（README の未決事項）

## 阻害要因

無し。
