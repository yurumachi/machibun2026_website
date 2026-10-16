# EmDash を本採用する前の2つの関門

EmDash は、CPU と日本語の管理画面という2つの関門を通ったら本採用する（`docs/site-plan.md` の 3 章）。落ちたら、Keystatic Cloud か Pages CMS を、Astro の静的サイトと組み合わせる形に切り替える。ここには確かめ方と結果を書く。

## 関門2: 日本語の管理画面

### 翻訳の数（2026-10-15、`@emdash-cms/admin` 1.2.0）

管理画面の文字 3,372 のうち、1,476（44%）が英語のまま。site-plan を書いたときの 41% より増えた。新しい画面に、翻訳が追いついていない。

入力と公開の流れにも、英語が残る。例:

- 公開: 「Publish now?」「Publish changes?」「{title} is now live.」「Draft version」「Schedule publication」
- 画像: 「Drop an image here or browse」「Choose an image from the library or upload a new one.」「Uploading image…」「Describe the image」「Edit image」
- 入力: 「URL slug」「Auto-generated from the title. You can change it.」「{name} is required.」
- ログイン: 「Sign in to {siteName}」「Create passkey」「What is a passkey?」

翻訳をサイトの側で足す仕組みは無い（`admin.locales` は、出す言語を絞るだけ）。足すなら、EmDash に翻訳を送るか、パッケージに手を入れることになる。

### 試し方

管理用の Preview で行う。学生にも、招待してから同じ手順で触ってもらう。

1. https://preview-machibun-cms.yurumachi-yuruyuru.workers.dev/_emdash/admin を開き、パスキーでログインする。
2. 管理画面の言語を日本語にする。
3. 出展者を1件、新しく作る。名前・カテゴリ・ひとこと・紹介文・出展場所の番号・リンクを入れる。
4. 写真を、管理画面から上げて付ける（KV に置く仕組みで、管理画面から上げるのは初めて）。
5. 下書きで保存し、トップページに出ないことを見る。
6. 公開し、トップページに出ることを見る。
7. 公開した出展者の紹介文を直し、もう一度公開する。
8. お知らせを1件作って公開し、一覧の上に固定する。
9. 出演者と出演枠を1件ずつ作り、スケジュールに出ることを見る。

### 書き残すこと

- 英語のままで、意味が分からなかった画面と文言
- 迷った操作（どこを押せばよいか分からなかった、など）
- 動かなかったこと（とくに 4 の写真）

判定の目安: 出展者・実行委員が、説明書を1枚渡せば迷わず 3〜8 をできるなら通す。英語のせいで説明書が厚くなるなら、翻訳を EmDash に送れるか、間に合うかで判断する。

## 関門1: CPU（10ms）

### 測り方

- `wrangler.jsonc` で Workers Logs（`observability`）を有効にした。デプロイすると、1回のアクセスごとの CPU 時間が、Cloudflare の管理画面の Workers Logs に残る。site-plan に書いた `wrangler tail` の代わりにこれを使う。
- 無料プランの Workers Logs は、1日 20万件まで残し、3日で消える。試すアクセスの数では足りる。
- `feat/emdash-site` の Preview で、次のページを、それぞれ 20 回ほど開く: トップページ、管理画面の一覧、出展者の編集画面、画像（`/_emdash/api/media/file/...` と `/_image`）。
- あわせて、毎分の cron が上限で落ちていないかを見る。

### 1回目の結果（2026-10-15、Preview、見本データ）

ページごとに 15 回ほど開き、Workers Logs（`cf o11y telemetry query`）で CPU 時間を見た。単位は ms。

| ページ | CPU の最小 / 中央 / 最大 | 全体の時間の中央 |
|---|---|---|
| トップページ `/` | 42〜46 / 71〜96 / 172〜246 | 約 4 秒 |
| 無いページ（404） | 3 / 6〜7 / 55〜68 | 0.1〜0.2 秒 |
| 管理画面 `/_emdash/admin` | 2 / 3〜4 / 21〜34 | 0.1 秒 |
| setup（1回だけ） | 386 | 40 秒 |

- トップページは、ふつうに開いても 10ms の 7〜10 倍かかる。関門1は、今のままでは通らない。
- ただし、どのアクセスも失敗せず（`outcome: ok`）、上限で打ち切られなかった。打ち切られない理由は分かっていない。いつまでも打ち切られないとは考えない。
- トップページだけが重いのは、参照の項目を一件ずつ取っているため（出展者ごとにカテゴリ、出演枠ごとに出演者とステージ）と考えられる。全体の時間が 4 秒かかっているのも、問い合わせの数が多いためと見ている（未確認）。

### 内訳（2026-10-15、手元の開発サーバー、見本データ）

開発サーバー（workerd）の inspector につなぎ、トップページを 20 回開いたときの CPU の使われ方を記録した。D1 への問い合わせは、`cloudflare-internal:d1-api` に条件付きのブレークポイントを置いて数えた。手元の値は、Vite の開発用の仕組みの分だけ本番より重い（404 は、本番 6〜7ms、手元 15ms）。測るたびに ±10ms ほどぶれる。

| トップページ | 1回の CPU | D1 への問い合わせ |
|---|---|---|
| 今のまま | 87〜99ms | 58 回 |
| 参照を取らない（一時的に書き換えて測った） | 26〜29ms | 8 回 |

- 58 回のうち 50 回は、参照の項目を一件ずつ取る `getEmDashReferences` から出ている。1件の参照ごとに、元の項目を読み直し（出演枠は slug と id で2回）、参照の表を読み、参照先を読む。
- 1回の問い合わせごとに、D1 とのやり取りと結果の変換で 0.4ms ほど CPU を使う。返事を待つ時間は入らないが、数が多いと積み上がる。
- 参照を取らなくても、手元で 26〜29ms かかる。本番に直すと 15〜20ms ほどと見ている（未確認）。10ms は下回らない。
- 日付の整形（`toLocaleDateString` を呼ぶたびに書式を作る）は 5ms ほど。書式を一度だけ作る形に変えて測ったが、ぶれの中に収まり、差は確かめられなかった。

### 公開ページ以外の CPU（2026-10-15、Preview と本番、Workers Logs）

公開ページを前もって作っても Worker に残る処理を測った。単位は ms。どれも打ち切られなかった（outcome は ok）。

| 処理 | 回数 | CPU（最小 / 中央 / 最大） |
|---|---|---|
| 毎分の cron（本番） | 722 | 12 / 41 / 218 |
| 出展者を作る（`POST /_emdash/api/content/exhibitors`） | 1 | 69 |
| 公開する（`PUT /_emdash/api/content/exhibitors/:id`） | 1 | 102 |
| 写真を上げる（上げ先・送る・確定） | 各1 | 12・77・539 |
| 写真を配る（`/_emdash/api/media/file/...`） | 3 | 3 |
| 写真を変換する（`/_image`） | 1 | 23 |
| 管理画面を開く | 41 | 2 / 4 / 63（しばらく使っていなかった後は 53〜63） |
| ログイン（パスキーの確認） | 2 | 21・57 |

- cron は、1日 1,440 回、ほぼ毎回 10ms を超えている。14 時間で 700 回以上超えても、打ち切られていない。Cloudflare が「いつも超える」とみなす基準は公開されておらず、今後も打ち切られないとは言えない。
- 保存・公開・写真の確定は、1回ごとに上限の 7〜50 倍かかる。運営が使う回数は少ないが、締切の前に出展者がまとめて入力すると増える。

### 軽くする手

- ページのキャッシュ: `@astrojs/cloudflare` の `cacheCloudflare()` と、Workers Caching（`wrangler.jsonc` の `cache`）をつないだ（2026-10-15）。トップページは `Cloudflare-CDN-Cache-Control: public, max-age=300` を返すようになったが、Preview ではキャッシュから返らず、毎回 Worker が動いた（`Cf-Cache-Status` が無く、`Cloudflare-CDN-Cache-Control` も消されずに外まで届く）。本番では、同じ設定で `Cf-Cache-Status: HIT` が返った。
  - Preview で効かないのは、`wrangler preview` の不具合（cloudflare/workers-sdk#16218、2026-10-12 から未解決）。Cloudflare の文書は「Preview も本番とは別にキャッシュする」と書いている。wrangler は、本番に上げるときはキャッシュの設定を `cache_options` という名前で送るが、Preview を作るときは `cache` という名前で送り、Preview では設定が残らない。`dist/server/wrangler.json` には `previews.cache` が入っていて、ビルドの wrangler（4.150.0）も送っているので、こちらの設定の誤りではない。
  - 直るまで、キャッシュにかかわる動き（公開したときに消えるか、ログインしたときに `no-store` になるか）は、Preview では確かめられない。wrangler が直ったら、`cms/package.json` の wrangler を上げる。
  - キャッシュを有効にすると、静的なファイルへのアクセスも Workers のリクエスト数（無料は1日 10万）に数えられる。
  - Preview はそれぞれ別のキャッシュを持つ。管理用の Preview で公開しても、消えるのはその Preview のキャッシュだけで、feat ごとの Preview は最長 5 分古いまま出る。本番は管理画面と公開ページが同じなので、この問題は無い。
  - キャッシュから返っても、キャッシュに無いとき（初めてのアクセス、公開の直後、5 分ごと）は今と同じ CPU 時間がかかる。上限を下回るわけではない。
- 公開ページを前もって作る（2026-10-15 に調べ中）: 公開ページをビルドのときに HTML にし、静的なファイルとして配る。静的なファイルは Worker を通らないので、CPU の上限にかからない。公開したらビルドし直す。
  - EmDash の読み出し（`getEmDashCollection` など）は、ビルドのときにも動く。手元で、トップページに `export const prerender = true` を付けてビルドし、手元の D1 の中身（お知らせ・出展者）が HTML に入ることを確かめた（作業用のコピーで試し、repo は変えていない）。
  - Workers Builds で本物の D1 を読むには、D1 の binding に `remote: true` を付け、アダプターの `remoteBindings` を CI のときだけ有効にする形になる。CI で認証が通るか、Preview のビルドで Preview 用の D1 を読めるか（本番の D1 を読んでしまわないか）は、確かめていない。
  - ビルドし直すきっかけは、Workers Builds の Deploy Hooks（URL に POST するとビルドが始まる。待っている間に重ねて呼んでも1回にまとまる）と、EmDash のプラグインの `content:afterPublish` で作れる。
  - 下書きのプレビューは、公開ページの URL に `?_preview=<token>` を付けて、アクセスのたびに組み立てる仕組み（`getPreviewUrl`）。前もって作ったページは `_preview` を見ないので、プレビュー用にアクセスのたびに組み立てる道を別に用意する必要がある。作り方は決まっていない。
  - Worker を通り続けるもの: 管理画面（3〜4ms）、出展者などが編集用の鍵で書き換えるフォーム、画像（`/_emdash/api/media/file/...`、`/_image`）。画像の CPU は測っていない。
  - ページのキャッシュ（`cache.enabled`）は外す。入れたままだと、静的なファイルも Worker のリクエスト数に数えられる。
- EmDash を入力の場所だけにし、公開ページは別にビルドする（2026-10-15、手元の EmDash 1.2.0 で REST API を試した）:
  - 一覧は `GET /_emdash/api/content/{collection}?status=published&limit=100`。`status=published` で公開済みだけになる。一覧の `data` には参照が入らない。
  - 一件は `GET /_emdash/api/content/{collection}/{id}`。`item.references.<項目>.children[]` に参照先の `title` が入る（出展者のカテゴリ、出演枠の出演者とステージを確かめた）。トップページの分は、一覧4回と一件14回の、合わせて 18 回で取れる。
  - 認証が要る（無いと 401）。管理者が API token を作れ、権限は `content:read`・`media:read` のように絞れる（`@emdash-cms/auth` の `VALID_SCOPES`）。
  - 写真のファイルは、公開ページが使っている `/_emdash/api/media/file/<storageKey>` から認証なしで取れる。REST API の写真の項目の形は、手元に写真が無く確かめていない。
- 一件ずつの問い合わせを減らす: カテゴリを select の項目にする、出演枠を出演者の中のくり返し項目にする、など。中身の設計が変わるので、user と相談する。

### 判定の目安

公開サイトは前もって作った静的なファイルで配ることにした（ADR 0006）。Worker の CPU を使うのは、管理画面と編集用の鍵のフォームだけになる。

- 管理画面と編集用の鍵のフォームで、関門2の手順（入力・写真・公開）を通したときに、Error 1102 で止まらないなら通す。たまに 10ms を超えるのは構わない。
- 関門2で学生に試してもらうときに、あわせて Workers Logs で `outcome` を見る。

### デプロイの前に決めること

- デプロイの方法。cf は `wrangler.jsonc` の project を、`cf migrate` で移さないとデプロイできない（Cloudflare の文書「cf and Wrangler」）。ADR 0005 で移さないことにしたので、cf ではデプロイできない。
- 最初の管理者の作り方。EmDash は、空のデータベースで最初に管理画面を開いた人が管理者を作れる（合言葉などは無い）。デプロイしたら、すぐに管理者を作る必要がある。
