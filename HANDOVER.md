# 引き継ぎ: EmDash の試作

## いまの状態

- デザインのモック（`docs/prototype/mock/`）と、CMS に載せる中身の設計（`docs/content-model.md`・`GLOSSARY.md`・`docs/adr/`）までできている。
- 開発は Docker のコンテナで行う。`Dockerfile` と `compose.yaml` は用意済みで、Node 22・pnpm 11.9.0（`site/package.json` の `packageManager` に合わせた）・uv（Python 3.13）が入る。ホストには Node を入れない。
- EmDash のサイトは `site/` にある（Cloudflare 向けの Starter から作った）。`cf` は `site/` の devDependencies に入っている。
  - 中身の種類（出展者・出演者・出演枠・ステージ・カテゴリ・協賛・お知らせ）は `site/seed/seed.json` に定めた。見本のデータも入っている。
  - トップページ（`site/src/pages/index.astro`）は、モックの CSS（`site/src/styles/`）と画像（`site/public/assets/`）を移し、CMS の中身を出す。キャッチコピー・開催日・会場は HTML に直接書いている。
  - Starter の posts・pages・カテゴリ・タグのページは消した。
- ブランチは `feat` と `main` だけ。`feat` ブランチで開発し、PR で `main` に取り込む。`develop` は作らない（1人で開発し、`feat` のプレビューで確かめられるため）。いまの作業は `feat/emdash-site`（commit はまだ）。
- 環境は3つ。データはそれぞれ別で、つながない。
  - 手元（コンテナ）: `site/.wrangler/` に保存されるデータ。seed から作り、いつでも作り直せる。
  - ステージング: 本番とは別の Worker と D1・R2。`feat` ごとのプレビューと、`main` と同じコードの決まった URL。運営のアカウントは作らず、画面に「ステージング」の帯を出す。
  - 本番: `main` に入ったら自動でデプロイする Worker と D1・R2。

## 手元で動かす

1. `docker compose up` で開き、http://localhost:4321 を見る。
2. 初めて開いたときは中身の種類だけが入り、見本のデータは入らない。
   http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin を開くと、見本のデータが入り、開発用の管理者でログインできる。
3. seed を変えたら、`site/.wrangler/` を消して作り直す（seed は空のデータベースにしか入らない）。

## 分かったこと

- 参照の項目（カテゴリ・出演者・ステージ）は、一覧の `entry.data` に入らない。一件ずつ `getEmDashReferences` で取っているので、出展者と出演枠の数だけ問い合わせが走る。デプロイして遅いか CPU の上限を超えるなら、カテゴリを select の項目にする、出演枠を出演者の中のくり返し項目にする、などを考える（中身の設計が変わるので user と相談する）。
- 日時の項目は `Date` ではなく文字列で返る。
- `@astrojs/cloudflare` は、画像の変換に `IMAGES`、セッションに KV の `SESSION` を使う。Worker を作るときに用意が要る。
- 管理画面には日本語がある（ログイン画面の言語の切り替え）。使い勝手はまだ見ていない。

## 次にやること

1. 管理画面を日本語にして、中身の入力・下書き・公開を一通り試す（`site-plan.md` の関門の一つ）。
2. 出展者の詳細ページ（`/exhibitors/{slug}`）とお知らせのページ（`/notices/{slug}`）を作る。トップページのリンク先がまだ無い。
3. 本番用とステージング用の Worker を作り、`feat` のプレビューがステージングの D1・R2 につながるかを確かめる（本番と同じデータにつながるなら、設定を見直す）。
4. デプロイして、CPU の上限（無料プランは 10ms）を超えていないかをログで確かめる。日付と時刻が日本語・日本時間で出るかも見る（手元は Node、本番は workerd で動くため）。
5. 写真のある出展者とロゴのある協賛を管理画面から入れ、トップページの画像の表示を確かめる（見本のデータに画像が無く、まだ一度も動かしていない）。

## 決まっていないこと

- デプロイ先の Cloudflare アカウント（個人かゆるまちの共用か）。手元の開発には要らない。
- 協賛のランク・見せ方・広告との分け方（`docs/content-model.md` の「決まっていないこと」）。トップページの協賛は、ロゴのある協賛をロゴで、無い協賛を名前で並べるだけにしている。
- 出展者のスラッグは年をまたいで重なりうる（例: 2026 年と 2027 年の同じ店）。URL に年を入れるかは、詳細ページを作るときに決める。
