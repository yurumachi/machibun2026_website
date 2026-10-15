# 引き継ぎ: 管理画面と公開サイトを分ける

## 決まったこと（2026-10-16）

EmDash を入力の場所（管理画面と編集用の鍵のフォーム）にだけ使い、公開サイトはビルドで作った静的なファイルで配る（ADR 0006）。CPU の上限（無料プランで 10ms）のため。測った結果は `docs/notes/emdash-gates.md`。

| 項目 | 決まったこと |
|---|---|
| フォルダ | `cms/`（EmDash。2026-10-16 に `site/` から名前を変えた）と `web/`（公開サイト、Astro の静的なサイト）を同じ repo に置く |
| Worker | いまの `machibun-website` の名前を `machibun-cms` に変える。公開サイト用に `machibun-website` を新しく作る（静的なファイルだけ）。パスキーはホスト名に結び付くので、管理者は作り直す |
| 中身の受け渡し | `web/` のビルドで、CMS の REST API を読むだけの API token（`content:read`・`media:read`）で読む。`web/` の Preview は CMS の Preview を、本番は CMS の本番を読む。token も分ける |
| ビルドし直すきっかけ | 公開・公開の取り消し・削除、公開中のものの保存があると、`cms/` のプラグインのフックが `web/` の Deploy Hook を呼ぶ。下書きの保存では呼ばない。コードの変更では、ビルドの設定の `path-includes` で `cms/**`・`web/**` ごとに絞る |
| 写真 | 元は KV のまま（ADR 0004）。`web/` のビルドで取ってきて縮め、公開サイトから配る |
| 下書きのプレビュー | 作らない。公開してから直すことが多いと分かったら考える |
| cron | 1時間ごと（`0 * * * *`）。予約した公開は使わない。使うときは 15 分ごとにする |
| 関門1 | 管理画面と編集用の鍵のフォームが Error 1102 で止まらないかで判断し、関門2と一緒に確かめる |
| 言葉 | 「公開サイト」「管理画面」を GLOSSARY に足した |

## 次にやること

1. （済み、2026-10-16）`site/` を `cms/` に名前を変え、cron を `0 * * * *` にした。`cms/wrangler.jsonc` の `name` はまだ変えていない（Worker の名前を変えるときに一緒に変える）。Workers Builds のビルドの設定の root はまだ `site` を見ているので、4 で root を直すまで push しない。
2. （済み、2026-10-16）`web/` を作った。トップページ・404・レイアウト・CSS・画像を `cms/` から移し、REST API から読む形にした（`web/src/lib/cms.ts`）。手元の CMS を読んでビルドが通り、写真は `/_astro/` の webp に縮まる（2.27MB が 57〜169KB）。
   - 手元のビルド: `web/.env` に `CMS_URL=http://localhost:4321` と、手元の管理者で作った読むだけの token（`CMS_TOKEN`）を置く。token は `POST /_emdash/api/admin/api-tokens`（`{"name":"web-build-read","scopes":["content:read","media:read"]}`）で作る。
   - 管理者の token で読むと、参照する側（出展者・出演枠）から取る API は、下書きの版を返す。一件を取る API（`{collection}/{id}`）は下書きの名前を、`{id}/references/{relation}/children` は下書きで選び直した参照を返す（手元で確かめた。`relations.ts` の `stagedPageFor`）。API token は管理者しか作れないので、権限では避けられない。
   - そこで、一覧（`status=published`、公開中の版を返す）と、参照される側（カテゴリ・出演者・ステージ）から取る `{id}/references/{relation}/parents` だけを使う。`parents` は公開中のつながりだけを返す。下書きを残したままビルドして、公開サイトに下書きが出ないことを確かめた。
   - REST API は、索引の無い項目では並べ替えられない（`Custom fields must be indexed before sorting`）。並べ替えは `web/` の側で行う。
   - ビルドのたびに CMS の Worker に、一覧 7 回と、カテゴリ・出演者・ステージの数だけの GET が届く。1回ごとの CPU は測っていない。Cloudflare に出したら Workers Logs で見る。
3. （済み、2026-10-16）`cms/` を管理画面だけにした。公開ページのキャッシュの設定（`routeRules`・`cache`）を消し、`/` は `/_emdash/admin` に転送する。フックのプラグイン（`cms/src/plugins/rebuild-web.ts`）を足した。
   - 公開・公開の取り消し・削除・復元と、公開中で下書きの版が無いものの保存（下書きの仕組みが無いカテゴリ・ステージ・出演枠）で、環境変数 `DEPLOY_HOOK_URL` に POST する。下書きの保存・破棄・新しい下書きでは呼ばない。手元で、コンテナの中に立てた受け口（port 4599）で確かめた。
   - 手元の `cms/.env` の `DEPLOY_HOOK_URL` は `http://localhost:4599/hook`。受け口が無いときは、呼んで失敗したことがログに出るだけで、公開は止まらない。
   - 本番と Preview では、Worker の secret に `DEPLOY_HOOK_URL` を置く（4 で作る）。無ければ、警告をログに出してビルドし直さない。
4. Cloudflare の作業。**どれも、する前に user に聞く。**
   - Worker `machibun-website` の名前を `machibun-cms` に変え、同時に `cms/wrangler.jsonc` の `name` も変える（変えないと、次のビルドで `machibun-website` がもう一度作られる）。ビルドの設定の root を `cms` にする。
   - 公開サイトの Worker `machibun-website` と、ビルドの設定（本番・Preview、root は `web`）を作る。
   - Deploy Hook と、環境ごとの API token を作る。
   - 本番用のビルドの設定（`f5bb4f2d-8eca-4204-9909-92f321b036be`）の `branch_includes` が、一時的に `["feat/emdash-site"]` のままになっている。`["main"]` に戻す。
5. 管理用の Preview（`preview-machibun-cms...`）で管理者を作り直し、関門2を user と学生で試す（手順は emdash-gates.md）。
6. 出展者の詳細ページとお知らせのページを `web/` に作る。
7. PageSpeed（本番、モバイル 59 点）で出た、フォントと画像の重さを直す。Google Fonts の Noto Sans JP（CSS 60KB、フォント 720KB）が表示を止めている。イラストが表示の大きさより大きい。

## いまの状態

- ブランチは `feat` と `main` だけ。いまの作業は `feat/emdash-site`。`main` は保護されていて、PR で取り込む。
- 開発は Docker のコンテナで行う（Node 22・pnpm 11.9.0・uv）。ホストには Node を入れない。
- EmDash は `cms/` にある（2026-10-16 に `site/` から名前を変えた）。公開ページは `web/` に移し（段2）、`cms/` は管理画面だけにした（段3）。
  - 中身の種類は `cms/seed/seed.json`。見本のデータも入っている。
  - トップページは `web/src/pages/index.astro`。キャッチコピー・開催日・会場は HTML に直接書いている。
- 画像は KV（`MEDIA`）に置く（ADR 0004）。置き場所の処理は `cms/src/storage/kv.ts`。
- Worker の設定は `cms/wrangler.jsonc`（ADR 0005）。
- 環境は3つで、データはつながない。
  - 手元（コンテナ）: `cms/.wrangler/` に保存する。seed から作り、いつでも作り直せる。
  - Preview: Cloudflare の Worker Previews。D1・KV は `wrangler.jsonc` の `previews` に書いた Preview 用のものを、すべての Preview で共有する。
    - 管理用の Preview（固定）: https://preview-machibun-website.yurumachi-yuruyuru.workers.dev/_emdash/admin 。管理者は user が作った（2026-10-15、パスキー）。Worker の名前を変えると URL が変わり、作り直しになる。
    - feat ごとの Preview: `https://<ブランチ名>-machibun-website.yurumachi-yuruyuru.workers.dev`。
  - 本番: https://machibun-website.yurumachi-yuruyuru.workers.dev 。D1 は setup 済み（見本と試しのデータだけ）。
- デプロイは Cloudflare の Git 連携（Workers Builds）で行い、Cloudflare の側で wrangler が動く（私たちは打たない）。ビルドの設定は1つの Worker に2つまで。
  - 本番用（`f5bb4f2d-8eca-4204-9909-92f321b036be`）: `npx wrangler deploy`。
  - Preview 用（`7346b588-71ae-4cc3-a389-82df061055f2`）: `main` 以外を push すると `npx wrangler preview`。画面からは作れず、`cf builds triggers create` で作った。
  - 管理用の Preview は、Preview 用の設定を一時的に `npx wrangler preview --name preview` にして1回出し、元に戻した。
- D1 と KV（アジア太平洋に置いた）:

  | | 本番 | Preview |
  |---|---|---|
  | D1 | `machibun`（`c7349d56-5024-47bc-b3aa-905af1664633`） | `machibun-preview`（`9af2f4b3-ccc7-41f6-892b-50434720730d`） |
  | KV `MEDIA` | `machibun-media`（`8c115efcc8d74942b5be5e9275f88366`） | `machibun-preview-media`（`2ae641097d0d449589fce79a71056d81`） |
  | KV `SESSION` | `machibun-session`（`d9219de9ab9f4f74af67822991ce1aca`） | `machibun-preview-session`（`346f84bf0a62489db258a863451895ae`） |

- `cf` のログインは volume（`cf_config`）に残る。

## 手元で動かす

1. `docker compose up` で開き、http://localhost:4321 を見る。
2. http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin を開くと、見本のデータが入り、開発用の管理者でログインできる。
3. seed を変えたら、`cms/.wrangler/` を消して作り直す（seed は空のデータベースにしか入らない）。
4. 開発サーバーが動いているときに、別のコンテナで `pnpm build` を打たない。共有している `node_modules/.vite` が書き換わり、開発サーバーが 500 を返す（`docker compose restart dev` で直る）。ビルドを試すときは、`/tmp` にコピーして `pnpm install --offline` してから打つ。

## 分かったこと

- EmDash のパスキーは、URL のホスト名に結び付く。Worker 名・workers.dev のサブドメイン・ドメインを変えると、作ったパスキーではログインできない。
- 空のデータベースで最初に管理画面を開いた人が、管理者を作れる。デプロイしたら、すぐに管理者を作る。
- 写真が縮められず元のまま出ているのは、`siteUrl`（`EMDASH_SITE_URL`）が無く、EmDash が `image.remotePatterns` を足さないため。公開サイトをビルドで作るなら、この直しは要らない。
- Preview ではキャッシュが効かない。wrangler の不具合（cloudflare/workers-sdk#16218）。issue にコメントするかは user が決める。
- cron は、予約した公開・掃除（1時間に1回）・プラグインの保存場所の索引作り（起動して最初の1回）を動かす。索引は cron でしか作られないので、編集用の鍵や連絡先のプラグインを作ったら、cron を止めない。
- 日時の項目は `Date` ではなく文字列で返る。
- `@astrojs/cloudflare` は、画像の変換に `IMAGES`、セッションに KV の `SESSION` を使う。
- `cms/` で `cf deploy` を打たない（`wrangler.jsonc` だけだと、`cf` が `astro.config.mjs` を書き換えようとする。ADR 0005）。
- Workers Logs の集計は `cms/.wrangler/cpu.mjs`（gitignore されている）。`cf o11y telemetry query --body` の結果を `/tmp/ev.json` に置いて、`node .wrangler/cpu.mjs` で集計する。

## 決まっていないこと

- 協賛のランク・見せ方・広告との分け方（`docs/content-model.md`）。
- 出展者のスラッグは年をまたいで重なりうる。URL に年を入れるかは、詳細ページを作るときに決める。
- GitHub の repo 名を `machibun_website` に変える（user が行う）。
- 管理画面の入口を Cloudflare Access で絞るか。
