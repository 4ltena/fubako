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

### 2. 未タグは既定で伏せる

書き手にタグ付けを強制しない。ただしタグのない投稿は、地雷宣言をしている読み手に対しては「未確認」として伏せられる。

これでタグ付けの動機が生まれ、かつ判定漏れが安全側に倒れる。

### 3. 可視性の時間非対称

投稿は `expiresAt` を過ぎると他のメンバーから見えなくなる。書いた本人のアーカイブには残り続ける。

デジタルタトゥーも誤爆も「他人が持っていること」が問題なので、自分側に残っても安心は壊れない。

---

## 技術構成

| 層 | 採用 |
|---|---|
| フロント / サーバ | Next.js (App Router) + TypeScript + Tailwind CSS |
| DB | PostgreSQL + Prisma |
| 認証 | Auth.js v5（Discord OAuth ＋ メールのマジックリンク） |
| タグ自動推定（Phase 5） | Anthropic API（サーバ側からのみ呼ぶ） |
| ダイジェスト | Vercel Cron（1日1回） |
| ホスティング | Vercel + Neon |

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
```

---

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
    me/mutes/
    cron/digest/
components/
  PostCard.tsx               伏せの表示・開く・反応
lib/
  veil.ts                    伏せ判定。ここが製品の心臓
  visibility.ts              寿命と可視性の判定
  timeline.ts                タイムライン組み立て。伏せた投稿の本文をここで落とす
scripts/
  smoke.mjs                  起動中サーバに対する通しテスト
  seed.mjs                   開発用の仮データ（SMTP 無しで画面を触るためのセッション付き）
prisma/
  schema.prisma
```

`lib/veil.ts` と `lib/visibility.ts` は必ずユニットテストを書く。ここが壊れると製品の約束が壊れる。

---

## 検索避け

- `robots.txt` で全パスを Disallow
- 全ページに `noindex, nofollow`
- OGP メタタグを出さない（外部に本文を漏らさない）
- サークルは招待コードなしでは存在自体が見えない

---

## 指標

- 成功：導入した人が2週間後も週2回以上投稿している
- 撤退：初週で投稿が止まる人が半数を超える。または「結局Xに書いた」が多数

バズは指標にしない。この製品はバズが起きたら設計が失敗している。

---

## 未決事項

- サークルの人数上限（暫定30人。Pathの50人が参考）
- 寿命の既定値（暫定7日、未検証）
- 画像を許すか（推し活の投稿はグッズ写真やスクショが中心なので落とすと痛い。ただし身バレと転載のリスクが上がり、タグ自動推定も難しくなる）
- 名前（「ふばこ」は仮）
