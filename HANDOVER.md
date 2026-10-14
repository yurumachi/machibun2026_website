# 引き継ぎ: EmDash の試作

## いまの状態

- デザインのモック（`docs/prototype/mock/`）と、CMS に載せる中身の設計（`docs/content-model.md`・`GLOSSARY.md`・`docs/adr/`）までできている。
- 開発は Docker のコンテナで行う。`Dockerfile` と `compose.yaml` は用意済みで、Node 22・pnpm 11.9.0（`site/package.json` の `packageManager` に合わせた）・uv（Python 3.13）が入る。ホストには Node を入れない。
- EmDash のサイトは `site/` にある（Cloudflare 向けの Starter から作った）。`cf` は `site/` の devDependencies に入っている。
  - 中身の種類（出展者・出演者・出演枠・ステージ・カテゴリ・協賛・お知らせ）は `site/seed/seed.json` に定めた。見本のデータも入っている。
  - トップページ（`site/src/pages/index.astro`）は、モックの CSS（`site/src/styles/`）と画像（`site/public/assets/`）を移し、CMS の中身を出す。キャッチコピー・開催日・会場は HTML に直接書いている。
  - Starter の posts・pages・カテゴリ・タグのページは消した。
- ブランチは `feat` と `main` だけ。`feat` ブランチで開発し、PR で `main` に取り込む。`develop` は作らない（1人で開発し、`feat` のプレビューで確かめられるため）。いまの作業は `feat/emdash-site`。
- 環境は3つ。データはそれぞれ別で、つながない。
  - 手元（コンテナ）: `site/.wrangler/` に保存されるデータ。seed から作り、いつでも作り直せる。
  - ステージング: 本番とは別の Worker と D1・KV。`feat` ごとのプレビューと、`main` と同じコードの決まった URL。運営のアカウントは作らず、画面に「ステージング」の帯を出す。
  - 本番: `main` に入ったら自動でデプロイする Worker と D1・KV。
- デプロイ先は、まちぶんの Cloudflare アカウント。`cf` のログインは volume（`cf_config`）に残るので、コンテナを作り直してもログインし直さなくてよい。
- 画像は R2 ではなく KV（`MEDIA`）に置く（ADR 0004）。置き場所の処理は `site/src/storage/kv.ts`。手元で、上げる・表示する・一覧する・消すを確かめた。
- D1 と KV は `cf` で作り（2026-10-15）、`site/wrangler.jsonc` につないだ。ステージングは `env.staging` に書き、`CLOUDFLARE_ENV=staging` でビルドするとそちらにつながる（ビルドの結果で確かめた）。D1 はアジア太平洋（APAC）に置いた。

  | | 本番 | ステージング |
  |---|---|---|
  | D1 | `machibun2026`（`4dff514e-9f3f-4ddf-a2d7-273fbce121bc`） | `machibun2026-staging`（`238b67c7-ab67-4305-b6ea-f0f285c2f704`） |
  | KV `MEDIA` | `machibun2026-media`（`8c115efcc8d74942b5be5e9275f88366`） | `machibun2026-staging-media`（`2ae641097d0d449589fce79a71056d81`） |
  | KV `SESSION` | `machibun2026-session`（`d9219de9ab9f4f74af67822991ce1aca`） | `machibun2026-staging-session`（`346f84bf0a62489db258a863451895ae`） |

## 手元で動かす

1. `docker compose up` で開き、http://localhost:4321 を見る。
2. 初めて開いたときは中身の種類だけが入り、見本のデータは入らない。
   http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin を開くと、見本のデータが入り、開発用の管理者でログインできる。
3. seed を変えたら、`site/.wrangler/` を消して作り直す（seed は空のデータベースにしか入らない）。

## 分かったこと

- 参照の項目（カテゴリ・出演者・ステージ）は、一覧の `entry.data` に入らない。一件ずつ `getEmDashReferences` で取っているので、出展者と出演枠の数だけ問い合わせが走る。デプロイして遅いか CPU の上限を超えるなら、カテゴリを select の項目にする、出演枠を出演者の中のくり返し項目にする、などを考える（中身の設計が変わるので user と相談する）。
- 日時の項目は `Date` ではなく文字列で返る。
- `@astrojs/cloudflare` は、画像の変換に `IMAGES`、セッションに KV の `SESSION` を使う。Worker を作るときに用意が要る。`IMAGES` が無料プランで上限を超えたときに請求になるか、失敗になるかは確かめていない。
- Worker の型は、生成せずに `@cloudflare/workers-types` を使う（`wrangler types` を打たないため）。
- `cf` の設定は `cloudflare.config.ts` で、`cf workers types` で型を作れる（コピーで試した）。ただし Astro のアダプター 14 系は `wrangler.jsonc` しか読まず、`cloudflare.config.ts` を読むのはアダプター 15 のベータ（`@cloudflare/vite-plugin` 2.0 のベータ）から。EmDash 1.2.0 はアダプター `^14.3.1` を求めるので、今は `wrangler.jsonc` を消せない。移る条件と手順は ADR 0005 に書いた。対応の進み具合は https://github.com/emdash-cms/emdash/issues/3639 で見る。
- `wrangler.jsonc` だけのまま `cf deploy --dry-run` を打つと、Worker 名を `site` と判定し、`astro add cloudflare` で設定を書き換えようとする。`site/` で `cf deploy` を打たない。Starter にあった `deploy` の script（`wrangler deploy`）は消した。
- 手元の D1・KV は、`wrangler.jsonc` の ID ごとに分かれて保存される。ID を入れたときに手元のデータが空になったので、dev-bypass で見本を入れ直した。
- 開発サーバーが動いているときに、別のコンテナで `pnpm build` を打つと、共有している `node_modules/.vite` が書き換わり、開発サーバーが 500 を返す。`docker compose restart dev` で直る。
- 管理画面には日本語がある（ログイン画面の言語の切り替え）。使い勝手はまだ見ていない。

## 次にやること

1. 管理画面を日本語にして、中身の入力・下書き・公開を一通り試す（`site-plan.md` の関門の一つ）。
2. 出展者の詳細ページ（`/exhibitors/{slug}`）とお知らせのページ（`/notices/{slug}`）を作る。トップページのリンク先がまだ無い。
3. デプロイの方法を決めて Worker を作り、`feat` のプレビューがステージングの D1・KV につながるかを確かめる（本番と同じデータにつながるなら、設定を見直す）。D1 と KV は作ってある。
4. デプロイして、CPU の上限（無料プランは 10ms）を超えていないかをログで確かめる。日付と時刻が日本語・日本時間で出るかも見る（手元は Node、本番は workerd で動くため）。
5. 画像の表示が、Workers の無料枠（10万リクエスト/日）と `IMAGES` の無料枠に収まるかを、ステージングで測る（ADR 0004）。
   あわせて、最初のステージングで `/_image` の画像が出るかを確かめる。本番では、画像の変換が同じ Worker の `/_emdash/api/media/file/...` を取りに行くので、手元では起きない失敗がありうる。出なければ、別の手を考える前に、`@emdash-cms/cloudflare` にある `image-endpoint` が何をするものかを先に読む。

## 決まっていないこと

- 協賛のランク・見せ方・広告との分け方（`docs/content-model.md` の「決まっていないこと」）。トップページの協賛は、ロゴのある協賛をロゴで、無い協賛を名前で並べるだけにしている。
- 出展者のスラッグは年をまたいで重なりうる（例: 2026 年と 2027 年の同じ店）。URL に年を入れるかは、詳細ページを作るときに決める。
