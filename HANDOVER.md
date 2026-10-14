# 引き継ぎ: EmDash の試作

## いまの状態

- デザインのモック（`docs/prototype/mock/`）と、CMS に載せる中身の設計（`docs/content-model.md`・`GLOSSARY.md`・`docs/adr/`）までできている。
- 開発は Docker のコンテナで行う。`Dockerfile` と `compose.yaml` は用意済みで、Node 22・pnpm 11.9.0（`site/package.json` の `packageManager` に合わせた）・uv（Python 3.13）が入る。ホストには Node を入れない。
- EmDash のサイトは `site/` にある（Cloudflare 向けの Starter から作った）。`cf` は `site/` の devDependencies に入っている。
  - 中身の種類（出展者・出演者・出演枠・ステージ・カテゴリ・協賛・お知らせ）は `site/seed/seed.json` に定めた。見本のデータも入っている。
  - トップページ（`site/src/pages/index.astro`）は、モックの CSS（`site/src/styles/`）と画像（`site/public/assets/`）を移し、CMS の中身を出す。キャッチコピー・開催日・会場は HTML に直接書いている。
  - Starter の posts・pages・カテゴリ・タグのページは消した。
- ブランチは `feat` と `main` だけ。`feat` ブランチで開発し、PR で `main` に取り込む。`develop` は作らない（1人で開発し、`feat` の Preview で確かめられるため）。いまの作業は `feat/emdash-site`。
- 環境は3つ。データはそれぞれ別で、つながない。
  - 手元（コンテナ）: `site/.wrangler/` に保存されるデータ。seed から作り、いつでも作り直せる。
  - Preview: 本番と同じ Worker の中にできる確認用の環境（Cloudflare の Worker Previews）。D1・KV は `wrangler.jsonc` の `previews` に書いた Preview 用のものを、すべての Preview で共有する。
    - 管理用の Preview（固定）: https://preview-machibun-website.yurumachi-yuruyuru.workers.dev/_emdash/admin 。中身の入力とログインはここだけで行う。管理者は user が作った（2026-10-15、パスキー）。
    - feat ごとの Preview: `https://<ブランチ名>-machibun-website.yurumachi-yuruyuru.workers.dev`。公開ページを確かめる。EmDash のパスキーは URL のホスト名に結び付くので、ここでは管理画面にログインできない。
  - 本番: `main` に入ったら自動でデプロイする。https://machibun-website.yurumachi-yuruyuru.workers.dev （今は Cloudflare が置いた仮の Worker が出る）。
- デプロイは Cloudflare の Git 連携（Workers Builds）で行い、Cloudflare の側で wrangler が動く（私たちは打たない）。Worker 名は `machibun-website`。ビルドの設定は1つの Worker に2つまで。
  - 本番用: `main` を push すると `npx wrangler deploy`。
  - Preview 用: `main` 以外を push すると `npx wrangler preview`（ブランチ名の Preview）。画面で「プレビュービルドを有効化」をオンにしても作られなかったので、`cf builds triggers create` で作った。
  - 管理用の Preview は、Preview 用の設定を一時的に `npx wrangler preview --name preview` にして `feat/emdash-site` から1回出し、元に戻した。`main` に取り込んだら、本番用の設定のデプロイのコマンドを `npx wrangler deploy && npx wrangler preview --name preview` にし、`main` を push するたびに管理用の Preview も新しくする。
- Preview の URL を出すには、Worker の設定で「Preview URLs」をオンにする必要があった（`wrangler.jsonc` の `preview_urls` は本番のデプロイのときにしか効かない）。本番の workers.dev の URL もオンにしてある。
- 名前に年を入れない。中身は年をまたいで同じ D1 に置くため（ADR 0003）。
- デプロイ先は、まちぶんの Cloudflare アカウント。`cf` のログインは volume（`cf_config`）に残るので、コンテナを作り直してもログインし直さなくてよい。
- 画像は R2 ではなく KV（`MEDIA`）に置く（ADR 0004）。置き場所の処理は `site/src/storage/kv.ts`。手元で、上げる・表示する・一覧する・消すを確かめた。
- D1 と KV は `cf` で作り（2026-10-15）、`site/wrangler.jsonc` につないだ。ビルドの結果に、本番と Preview それぞれの ID が入ることを確かめた。D1 はアジア太平洋（APAC）に置いた。

  | | 本番 | Preview |
  |---|---|---|
  | D1 | `machibun`（`c7349d56-5024-47bc-b3aa-905af1664633`） | `machibun-preview`（`9af2f4b3-ccc7-41f6-892b-50434720730d`） |
  | KV `MEDIA` | `machibun-media`（`8c115efcc8d74942b5be5e9275f88366`） | `machibun-preview-media`（`2ae641097d0d449589fce79a71056d81`） |
  | KV `SESSION` | `machibun-session`（`d9219de9ab9f4f74af67822991ce1aca`） | `machibun-preview-session`（`346f84bf0a62489db258a863451895ae`） |

## 手元で動かす

1. `docker compose up` で開き、http://localhost:4321 を見る。
2. 初めて開いたときは中身の種類だけが入り、見本のデータは入らない。
   http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin を開くと、見本のデータが入り、開発用の管理者でログインできる。
3. seed を変えたら、`site/.wrangler/` を消して作り直す（seed は空のデータベースにしか入らない）。

## 分かったこと

- EmDash のパスキーは、URL のホスト名に結び付く。Worker 名・workers.dev のサブドメイン・ドメインを変えると、作ったパスキーではログインできなくなる。本番の URL は、運営のアカウントを作る前に決める。Preview もブランチごとに URL が変わるので、管理画面にログインできるのは管理者を作った Preview だけ。
- 空のデータベースで最初に管理画面を開いた人が、管理者を作れる（合言葉などは無い）。デプロイしたら、すぐに管理者を作る。

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

1. 管理画面を日本語にして、中身の入力・下書き・公開を一通り試す（関門2）。手順と翻訳の数は `docs/notes/emdash-gates.md`。
2. 出展者の詳細ページ（`/exhibitors/{slug}`）とお知らせのページ（`/notices/{slug}`）を作る。トップページのリンク先がまだ無い。
3. `main` に取り込んだら、本番用のビルドの設定を直し（上の「デプロイ」）、本番の URL を開いてすぐに管理者を作る。空のデータベースでは、最初に開いた人が管理者になる。
4. デプロイして、CPU の上限（無料プランは 10ms）を超えていないかを Workers Logs で確かめる（関門1。`docs/notes/emdash-gates.md`）。日付と時刻が日本語・日本時間で出るかも見る（手元は Node、本番は workerd で動くため）。
5. 画像の表示が、Workers の無料枠（10万リクエスト/日）と `IMAGES` の無料枠に収まるかを、Preview で測る（ADR 0004）。
   あわせて、最初の Preview で `/_image` の画像が出るかを確かめる。本番では、画像の変換が同じ Worker の `/_emdash/api/media/file/...` を取りに行くので、手元では起きない失敗がありうる。出なければ、別の手を考える前に、`@emdash-cms/cloudflare` にある `image-endpoint` が何をするものかを先に読む。

## 決まっていないこと

- 協賛のランク・見せ方・広告との分け方（`docs/content-model.md` の「決まっていないこと」）。トップページの協賛は、ロゴのある協賛をロゴで、無い協賛を名前で並べるだけにしている。
- 出展者のスラッグは年をまたいで重なりうる（例: 2026 年と 2027 年の同じ店）。URL に年を入れるかは、詳細ページを作るときに決める。
