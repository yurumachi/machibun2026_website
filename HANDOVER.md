# 引き継ぎ: 管理画面と公開サイトを分ける

## 決まったこと（2026-10-16）

EmDash を入力の場所（管理画面と編集用の鍵のフォーム）にだけ使い、公開サイトはビルドで作った静的なファイルで配る（ADR 0006）。CPU の上限（無料プランで 10ms）のため。測った結果は `docs/notes/emdash-gates.md`。

| 項目 | 決まったこと |
|---|---|
| フォルダ | `cms/`（EmDash。2026-10-16 に `site/` から名前を変えた）と `web/`（公開サイト、Astro の静的なサイト）を同じ repo に置く |
| Worker | もとの `machibun-website` の名前を `machibun-cms` に変えた。公開サイト用に `machibun-website` を新しく作った（静的なファイルだけ）。パスキーはホスト名に結び付くので、管理者は作り直した |
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
   - メディアライブラリの「差し替え」は、同じファイル名のまま写真を上書きし、EmDash のフックを一つも呼ばない。そこで `cms/src/middleware.ts` で、差し替えが成功したら Deploy Hook を呼ぶ。写真のファイルは ETag 付きで返るので、Astro はビルドのときに確かめ直して新しい写真を取る。差し替えで幅と高さが変わっても中身のデータには古い値が残るので、協賛のロゴは `inferSize` で測る。
   - Deploy Hook の呼び出しが失敗しても、やり直さない（ログに残るだけ）。公開サイトが古いままなら、Workers Builds の画面から公開サイトのビルドをやり直す。
   - 出演者かステージが公開されていない出演枠は、スケジュールに載せない。
4. （済み、2026-10-16）Cloudflare の作業（feat の Preview まで）。
   - Worker の名前を `machibun-cms` に変えた。`cf` に名前を変えるコマンドが無いので、user が画面で変えた。ビルドの設定と D1・KV とのつながりは、名前を変えても残った。
   - 管理画面のビルドの設定の root を `/cms` に、ビルドが動くフォルダを `cms/*` にした。
   - 本番と Preview の D1 を作り直し、user が両方で管理者を作った。Preview は、最初のパスキー登録に失敗してパスキーの無い管理者が残ったので、もう一度作り直した。
   - 公開サイトの Worker `machibun-website` は、user が画面の「リポジトリをインポート」で作った。`cf` では Git につないだ Worker を新しく作れない。
   - 両方の管理画面で読むだけの token（`web-build-read`）を作り、公開サイトのビルドの設定の変数 `CMS_TOKEN`（シークレット）に入れた。token は会話を通さず、user の端末で入れた。
   - 公開サイトの Preview: https://feat-emdash-site-machibun-website.yurumachi-yuruyuru.workers.dev 。Preview の CMS を読んでビルドが通った。
5. PR を `main` に取り込むときの作業。**どれも、する前に user に聞く。**
   - 管理画面の本番用のビルドの設定（`f5bb4f2d-8eca-4204-9909-92f321b036be`）の `branch_includes` は、一時的に `["feat/emdash-site"]` のまま。取り込む直前に `["main"]` に戻す。
   - 公開サイトの本番は、`main` に `web/` が入るまでビルドできない（Import のときの最初のビルドは `root directory not found` で失敗した）。本番の `CMS_TOKEN` が正しいかも、そこで初めて確かめられる。
   - 公開サイトの Deploy Hook（`main` のもの）を `cf builds deploy-hooks create machibun-website --branch main` で作り、管理画面の Worker の本番の secret `DEPLOY_HOOK_URL` に置く（`cf workers secrets update`）。いまの本番には `DEPLOY_HOOK_URL` が無いので、本番の CMS で公開してもどの公開サイトもビルドし直されない。
   - Deploy Hook の URL は `https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/<deploy_hook_uuid>`。作ったときの返事に URL は入らない。
6. EmDash は使える前提で進める（2026-10-16、user が決めた）。関門2の人による試し（user と学生、手順は emdash-gates.md）は後で行う。agent が通した結果は emdash-gates.md にある。試しのデータ（「関門2の試し」の出展者・お知らせ・出演者・出演枠）は、見本として残す。
   - （済み、2026-10-16）管理用の Preview で公開すると、公開サイトの Preview がビルドし直される。公開サイトの feat の Deploy Hook（`149a42e5-d57c-40b1-8484-b9f021b691c0`）を、管理画面の Worker の Preview の secret `DEPLOY_HOOK_URL` に置いた。
7. 出展者の詳細ページとお知らせのページを `web/` に作る（`main` に取り込む前に、この PR で行う）。今は一覧からのリンクが 404 になる。
8. PageSpeed の直しは別の issue で行う: フォント（#2）、イラストの大きさ（#3）。

## いまの状態

- GitHub の repo は `yurumachi/machibun_website`（2026-10-16 に `machibun2026_website` から名前を変えた）。Workers Builds は repo の id でつながっていて、名前を変えたあとも手でのビルドは通った。push でビルドが始まるかは、次の push で確かめる。
- ブランチは `feat` と `main` だけ。いまの作業は `feat/emdash-site`。`main` は保護されていて、PR で取り込む。
- 開発は Docker のコンテナで行う（Node 22・pnpm 11.9.0・uv）。ホストには Node を入れない。
- EmDash は `cms/` にある（2026-10-16 に `site/` から名前を変えた）。公開ページは `web/` に移し（段2）、`cms/` は管理画面だけにした（段3）。
  - 中身の種類は `cms/seed/seed.json`。見本のデータも入っている。
  - トップページは `web/src/pages/index.astro`。キャッチコピー・開催日・会場は HTML に直接書いている。
- 画像は KV（`MEDIA`）に置く（ADR 0004）。置き場所の処理は `cms/src/storage/kv.ts`。
- Worker の設定は `cms/wrangler.jsonc` と `web/wrangler.jsonc`（ADR 0005）。
- Worker は2つ。管理画面 `machibun-cms`（id `b1c4e98112cc462e8d3a029fcb4e33c8`）と、公開サイト `machibun-website`（id `fe28605a553a4d6b99d5fa1276217d3d`）。
- 環境は3つで、データはつながない。
  - 手元（コンテナ）: `cms/.wrangler/` に保存する。seed から作り、いつでも作り直せる。
  - Preview: Cloudflare の Worker Previews。D1・KV は `cms/wrangler.jsonc` の `previews` に書いた Preview 用のものを、すべての Preview で共有する。URL は `<Preview の名前>-<Worker の名前>.yurumachi-yuruyuru.workers.dev` で、名前はふつうブランチ名から作られる。
    - 管理用の Preview（固定）: https://preview-machibun-cms.yurumachi-yuruyuru.workers.dev/_emdash/admin 。管理者は user が作った（2026-10-16、パスキー）。
    - 公開サイトの Preview: https://feat-emdash-site-machibun-website.yurumachi-yuruyuru.workers.dev 。Preview の CMS を読む。
  - 本番: 管理画面は https://machibun-cms.yurumachi-yuruyuru.workers.dev/_emdash/admin（D1 は 2026-10-16 に作り直し、user が管理者を作った）。公開サイトの本番は、`main` に取り込むまで空。
- デプロイは Cloudflare の Git 連携（Workers Builds）で行い、Cloudflare の側で wrangler が動く（私たちは打たない）。ビルドの設定は1つの Worker に2つまで。
  - 管理画面の本番用（`f5bb4f2d-8eca-4204-9909-92f321b036be`）: `npx wrangler deploy`。root は `/cms`、`cms/*` が変わったときだけ。
  - 管理画面の Preview 用（`7346b588-71ae-4cc3-a389-82df061055f2`）: `main` と `feat/emdash-site` 以外を push すると `npx wrangler preview`。画面からは作れず、`cf builds triggers create` で作った。
  - 管理用の Preview は、Preview 用の設定を一時的に `npx wrangler preview --name preview` にし、`cf builds create <設定の id> --branch feat/emdash-site` で1回出して、元に戻した。
  - 公開サイトの本番用（`1bcd7adb-cc10-44f3-85f8-f53f2a161bd2`）: `main`、root は `/web`、`web/*` が変わったときだけ。変数 `CMS_URL`（本番の CMS）と `CMS_TOKEN`（シークレット）。
  - 公開サイトの Preview 用（`6e95cff8-3daf-47e0-866d-37905eed12ab`）: `main` 以外、`web/*` が変わったときだけ `npx wrangler preview`。変数は Preview の CMS のもの。`cf builds triggers create` は `--path-excludes` を求めるので、`--body` で作った。
  - Preview の URL は、Worker の「ドメイン」の画面で「プレビュー」を有効にしないと出ない。管理画面は最初の本番のデプロイで有効になったが、公開サイトは本番にデプロイする前だったので、user が画面で有効にした。
  - `wrangler preview` は、`wrangler.jsonc` に `previews` の項目が無いと止まる。公開サイトは空の `previews: {}` を置いた。
  - ビルドの変数のシークレットは、`cf builds triggers environment-variables upsert <設定の id> --body '{"CMS_TOKEN":{"value":"…","is_secret":true}}'` で入れる。コンテナには `curl` が無い。
- D1 と KV（アジア太平洋に置いた）:

  | | 本番 | Preview |
  |---|---|---|
  | D1 | `machibun`（`a9ce5dc4-8327-4cb5-84b1-dc8ca53cbaee`） | `machibun-preview`（`11da7c36-a9dc-4fb9-bec1-8bc78328277c`） |
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
- Worker Previews の secret は、本番の secret と別に持つ。画面の「設定」→ 変数とシークレットで、環境に「プレビュー」を選んで入れる（Preview の base config）。base config は、これから作る Preview にだけ付く。今ある Preview に付けるには、`cf previews delete <名前> --worker machibun-cms --force` で消してビルドし直す（同じ URL・同じ D1 で作り直されるので、パスキーと中身はそのまま）。`cf` には Preview の secret を入れるコマンドが無く、wrangler は `cf` のログインを使えない。
- 作ったばかりの D1 では、最初のアクセスで表を作る。その1回目は `SETUP_STATUS_ERROR` や `NOT_CONFIGURED` を返すが、2回目からは返らない。
- `cf d1 delete` は、対話できない端末では `--force` が要る。agent が打つと Claude Code の安全確認で止まるので、user が `!` で打つ。
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
- 管理画面の入口を Cloudflare Access で絞るか。
