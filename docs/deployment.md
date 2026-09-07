# デプロイ手順

本番の公開前に、移行、認証、画像保存、起動を順に確認する。環境変数の値や接続文字列を端末出力へ残さない。

## 前提

Node.js 24.x を使用する。`npm run build` は Webpack を指定して Next.js をビルドする。Turbopack の子プロセス生成に依存しない。

本番用の `DATABASE_URL` は PostgreSQL を指定する。Prisma の移行には、pooler を通らない `DATABASE_URL_UNPOOLED` を指定するとよい。実行時は `DATABASE_URL` を用いる。

`APP_URL` はパスや資格情報を付けない HTTPS の公開URLにする。Discord のリダイレクトURLは、同じURLの `/api/auth/callback/discord` をDiscord側へ登録する。メール認証にはSMTPと送信元を設定し、実際に届くマジックリンクでログインを確認する。

## 公開前の確認

環境変数を設定したシェルで、対象を明示して検査する。検査は値を表示せず、ネットワークやDBへ接続しない。

```sh
npm run deploy:check -- --target=vercel
# または
npm run deploy:check -- --target=docker
```

検査には `DATABASE_URL`、32文字以上の `AUTH_SECRET`、HTTPSの `APP_URL`、完全なDiscord認証またはメール認証の組が必要である。Vercel では `BLOB_READ_WRITE_TOKEN` も必要となる。

Vercel の `vercel.json` はダイジェストの定期実行を定義している。Vercel の公開では `EMAIL_SERVER`、`EMAIL_FROM`、32文字以上の `CRON_SECRET` をそろえる。ダイジェストを使わない構成では、公開前に `vercel.json` の定期実行を外してから検査条件も見直す。

Docker で Blob を使わない場合、画像は `.data/images/` に保存される。コンテナの書込み層だけでは再作成時に失われるため、`.data` へ永続ボリュームをマウントし、`LOCAL_IMAGE_STORAGE_PATH=.data` を明示する。

## 移行と公開

最初にバックアップと復旧手順を確認する。次に、アプリケーションを置き換える前に移行を一度だけ実行する。

```sh
npm run test:migrations
npm run db:migrate
npm run build
```

`test:migrations` はプロセス内PGliteで全移行を適用し、既存データの保持、既定値、公開状態のenum、話題伏せの一意制約と外部キーを確認する。運用DBへは接続しない。`db:migrate` は運用DBを変更するため、バックアップ確認後にデプロイ担当が実行する。

2026-09-07 の移行では、既存のセッションが `legacy` として扱われる。移行後、既存利用者はDiscordまたはメール認証で通常の再ログインが必要である。

Docker では、同じイメージを起動する前に次を実行する。

```sh
docker build -t fubako .
docker run --rm --env-file .env.production fubako npm run db:migrate
docker run --rm --env-file .env.production -p 3000:3000 -v fubako-data:/app/.data fubako
```

Vercel ではビルド中に移行を実行しない。デプロイ担当が運用DBへの移行を完了してから、環境変数を設定した公開を開始する。

## 公開後の確認

通常運用の検査では `PUBLIC_DEMO_LOGIN=1` をエラーとする。公開テストは次節の明示設定を用いる。

通常認証でログインし、投稿、画像の保存と閲覧、伏せ、自己記録、月別書き出しを確認する。メール認証を使う場合は実際の送信も確認する。Vercel 以外でダイジェストを動かす場合、Vercel Cron は有効にせず、`CRON_SECRET`、メール設定、HTTPSの `APP_URL` をそろえたうえで `npm run cron` を常駐させる。

## 公開テスト用の名前ログイン

名前だけで入る公開テストでは、対象のVercel環境に次の両方を設定し、この機能を含むコードを再デプロイする。公開ドメインで確認する場合は、そのデプロイに対応するProduction環境へ設定する。

```dotenv
PASSWORD_LOGIN=1
PUBLIC_DEMO_LOGIN=1
```

ユーザー名を入力してログインする。パスワード欄は網掛けの入力不可表示のまま残る。同じ名前を知る人は同じアカウントへ入れるため、テスト専用DBを使い、個人情報や実利用者の非公開データは保存しない。既存のユーザー名へも入れる方式なので、通常運用のDBへこの設定を適用しない。

`DATABASE_URL`、`AUTH_SECRET` とセッションの移行は引き続き必要であり、名前フォームの有効化だけではDB未設定や移行未適用を解決しない。公開デモでも `/api/dev/login` は無効。通常運用へ切り替える際は `PUBLIC_DEMO_LOGIN` を削除し、Discordまたはメール認証を設定して再デプロイする。demoセッションはその時点で拒否される。
