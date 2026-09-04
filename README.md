# ふばこ（仮称）

推し活の話を、地雷を踏む心配なしに雑に投げられる小さな場。
読み手が「見たくない語」を宣言しておくと、システムが自動で本文を伏せる。

---

## この製品が何をしないか

先にこちらを読んでほしい。機能を足したくなったら毎回ここに戻ること。

- DM を作らない
- フォロー / フォロワーを作らない
- 検索を作らない
- 公開プロフィールを作らない
- 引用・リポストを作らない
- 返信欄を作らない
- リアクション数を表示しない（投稿者にも見せない）
- プッシュ通知を作らない
- 既読を作らない

どれも「静かさ」を壊す。迷ったら作らないほうを選ぶ。

---

## 設計原則

実装で判断に迷ったら、この3つに戻す。

**A. 選ばせない**
公開範囲も寿命も既定値を持つ。無選択で投稿できる。設定画面を増やさない。

**B. 事後に取り消せる**
判断を後ろにずらす。投げるのは無条件、消すのは後から。寿命は短くする方向にだけ変更できる。

**C. 数えない・急かさない**
反応は届くが、数と催促は持たない。通知は1日1回のダイジェストのみ。

---

## 中核となる3つの仕組み

### 1. 伏せ（veil）

読み手が登録した語（MuteRule）に投稿のタグが一致すると、その投稿は本文を伏せた状態で表示される。伏せた理由（一致した語）は見える。読み手がタップすれば開く。

**本文はサーバ側で落とす。** タイムラインAPIのレスポンスに本文を含めない。クライアントでCSSやJSで隠す実装にはしない。開くときに `/api/posts/:id/reveal` を別途叩く。

書き手が注意文を付けた投稿は、地雷宣言の有無に関係なく全員に対して伏せられる。理由には注意文がそのまま出る。開いたあとも「書いた人が先に断っています」と残す。

伏せそこねたときは、読み手がその紙を自分のためだけに閉じられる（「これは伏せておく」）。書き手には何も届かず、通報でもない。いつでも戻せる。語の宣言は「見たくない語」に置いたままで、こちらは触らない。

画像も同じ判定に従う。伏せた状態ではサーバは blurhash と寸法だけを返し、画像本体は開いたあとに `/api/images/:id` が会員かつ可視のときだけ代理で返す。公開 URL は無い。アップロード時に EXIF は全て落とし、向きは画素に焼き込む。

### 2. 未タグは既定で伏せる

書き手にタグ付けを強制しない。ただしタグのない投稿は、地雷宣言をしている読み手に対しては「未確認」として伏せられる。

これでタグ付けの動機が生まれ、かつ判定漏れが安全側に倒れる。

未確認の紙が並んで読めないときは、いま並んでいる分だけをまとめて開ける。設定としては残さないので、これから届く紙は伏せたまま届く。

### 3. 可視性の時間非対称

投稿は `expiresAt` を過ぎると他のメンバーから見えなくなる。書いた本人のアーカイブには残り続ける。

デジタルタトゥーも誤爆も「他人が持っていること」が問題なので、自分側に残っても安心は壊れない。

---

## 技術構成

| 層 | 採用 |
|---|---|
| フロント / サーバ | Next.js (App Router) + TypeScript + Tailwind CSS v4 |
| 見た目 | 配布デザイン（Organic）。明暗は OS/ブラウザ追従で、切り替えは作らない |
| DB | PostgreSQL + Prisma |
| 認証 | Auth.js v5（Discord OAuth ＋ メールのマジックリンク） |
| タグ自動推定（Phase 5） | Anthropic API（サーバ側からのみ呼ぶ） |
| 形態素解析 | kuromoji.js（純粋 JS、ipadic 同梱。Vercel の関数内でも動く） |
| ダイジェスト | Vercel Cron、または node-cron（`npm run cron`、21:00 JST） |
| ホスティング | Vercel + Neon、または Docker（Render / Fly.io / VPS） |

X API は使わない。相互フォローのグラフ取得に有料枠が必要になる可能性が高い。狭さは招待コードと人数上限で作る。

Android ネイティブにしない理由は、プッシュ通知を持たない設計だから。ネイティブの最大の利点が設計上要らない。PWA にすれば Android 12 以降の Chrome からホーム画面に追加できる。アプリ配布が要件になったら Bubblewrap で TWA として包む。

---

## セットアップ

前提：Node.js 20 以上、PostgreSQL 15 以上（またはNeonのURL）

```bash
git clone <repo>
cd fubako
npm install
cp .env.example .env    # 下記を埋める
npm run db:dev          # ローカル DB が無ければ。表示された postgres:// の URL を DATABASE_URL に入れる（別ターミナルで動かし続ける）
npx prisma migrate dev
npm run dev
```

検証：

```bash
npm test                # lib/veil.ts と lib/visibility.ts のユニットテスト
npm run typecheck && npm run lint
npm run build && npm start   # 別ターミナルで
npm run smoke           # 起動中のサーバに対して、参加→投稿→伏せ→開く→寿命→削除を通しで叩く
npm run seed            # *@example.test の仮ユーザー5人・サークル・投稿・地雷宣言を投入し、貼るだけで入れるログイン用リンクを表示する（開発時のみ有効）
```

`.env` に必要なもの：

```
DATABASE_URL=postgresql://...
AUTH_SECRET=            # npx auth secret で生成
APP_URL=                # 招待リンクとダイジェストに載せる自分の URL
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=
EMAIL_SERVER=           # マジックリンク用SMTP
EMAIL_FROM=
CRON_SECRET=            # ダイジェストcronの認証用
ANTHROPIC_API_KEY=      # Phase 5以降のみ
BLOB_READ_WRITE_TOKEN=  # 未設定ならローカル保存
PASSWORD_LOGIN=         # 1 にすると名前+パスワードでログインできる（発表用の入口。テスト用）
```

---

## Vercel に置く

1. [Neon](https://neon.tech) で Postgres を作り、接続文字列を控える
2. Vercel にリポジトリを接続する
3. Vercel の環境変数に以下を設定する

   ```
   DATABASE_URL=            # Neon の接続文字列
   AUTH_SECRET=              # npx auth secret で生成
   BLOB_READ_WRITE_TOKEN=    # Vercel Blob を作ると自動で入る
   CRON_SECRET=              # ダイジェストcronの認証用。ランダムな値
   APP_URL=                  # デプロイ後の URL
   PASSWORD_LOGIN=1          # 発表で環境構築なしに入ってもらうための入口
   AUTH_DISCORD_ID=          # 任意
   AUTH_DISCORD_SECRET=      # 任意
   EMAIL_SERVER=             # 任意（マジックリンク用SMTP）
   EMAIL_FROM=               # 任意
   ```

4. デプロイする。`vercel.json` の `buildCommand`（`npx prisma migrate deploy && next build`）が Vercel のビルドのたびにマイグレーションを自動で適用する。cron 設定はそのまま使う

Docker（Render / Fly.io / VPS）で動かす場合はイメージビルド時に `DATABASE_URL` が無いため、マイグレーションはビルドに含めていない。デプロイ前に `npx prisma migrate deploy` を実行してから `npm start` すること。

発表が終わったら `PASSWORD_LOGIN` を外す（このログイン経路はパスワード再設定・レート制限を持たないテスト用の入口のため）。

---

### 速さ

- 関数は `vercel.json` の `regions: ["sin1"]` で Neon と同じシンガポールに置く。DB との往復が数 ms になる
- 発表など人に触ってもらう時間帯は、手元で `APP_URL=https://<公開URL> npm run warm` を回しておく。4 分おきに `/api/health` を叩き、関数のコールドスタートと Neon の自動停止（5 分無通信）を避ける。常時は回さない

## ディレクトリ

```
app/
  (auth)/login/
  (app)/
    page.tsx                 サークル一覧
    c/[circleId]/            タイムライン
    c/[circleId]/new/        投稿
    archive/                 自分の記録（期限切れ含む）
    settings/mutes/          地雷宣言
  join/[inviteCode]/
  api/
    circles/
    posts/
    images/
    me/mutes/
    cron/digest/
components/
  PostCard.tsx               伏せの表示・開く・反応
lib/
  veil.ts                    伏せ判定。ここが製品の心臓
  visibility.ts              寿命と可視性の判定
  timeline.ts                タイムライン組み立て。伏せた投稿の本文をここで落とす
  image.ts                   画像の再エンコードと blurhash
  storage.ts                 Blob かローカルディスク
  presence.ts                今日この場に来た人がいるか。真偽値だけ
  tags.ts                    そのサークルでよく使われた語（件数は返さない）
  invite.ts                  招待の言葉（ひらがな10文字）の生成と正規化
  draft.ts                   書きかけを端末に24時間だけ残す
  wear.ts                    紙のいたみ。寿命の残りを数字にしない
  form.ts                    投稿の形（一文・一枚・一句）の自動判定
  morph.ts                   kuromoji の呼び出しとパース。サーバ側のみ
  similar.ts                 近い投稿の突き合わせ。terms は外に出さない
scripts/
  smoke.mjs                  起動中サーバに対する通しテスト
  seed.mjs                   開発用の仮データ（SMTP 無しで画面を触るためのセッション付き）
  verify-tokenizer.mjs       形態素解析が動くかだけを確かめる
  backfill-terms.mjs         既存投稿に terms を後から入れる
  cron.mjs                   Vercel 以外でダイジェストを回す
prisma/
  schema.prisma
```

`lib/veil.ts` と `lib/visibility.ts` は必ずユニットテストを書く。ここが壊れると製品の約束が壊れる。

形態素解析は kuromoji.js（純粋 JS）なので追加のインストールは要らない。動作確認だけ単独で行うなら:

```bash
node scripts/verify-tokenizer.mjs   # 名詞と形容詞が返るか
```

---

## 検索避け

- `robots.txt` で全パスを Disallow
- 全ページに `noindex, nofollow`
- OGP メタタグを出さない（外部に本文を漏らさない）
- サークルは招待の言葉なしでは存在自体が見えない

---

## 指標

- 成功：導入した人が2週間後も週2回以上投稿している
- 撤退：初週で投稿が止まる人が半数を超える。または「結局Xに書いた」が多数

バズは指標にしない。この製品はバズが起きたら設計が失敗している。

---

## 未決事項

- サークルの人数上限（暫定30人。Pathの50人が参考。発表など大人数で使うときは `CIRCLE_MEMBER_LIMIT` で新しい箱の定員だけ上げる）
- 寿命の既定値（暫定7日、未検証）
- 名前（「ふばこ」は仮）
