# まちぶん2026 サイト方針（調査と提案）

調査日: 2026-10-12。事実（コード・実測）と推測を分けて書く。

## 1. デザイン: なぜ「チラシっぽくない」のか

チラシ（`docs/2023チラシ.pdf`、`docs/2024チラシ.ai`）と現状の `index.html` を見比べた結果、差は色ではなく次の4点にある。

| # | チラシ | 現状 | 直し方（色は今のまま） |
|---|---|---|---|
| 1 | blob は複数色が柔らかく混ざる面で、画面の端からはみ出し、ロゴに重なる | `--gradient-brand` が 90° の線形グラデーションで、最初の2色（`#C7C7C7`→`#E7E7E7`）が**灰色の帯**として見える。形は楕円に近い | 同じ4色を `radial-gradient` で重ねるか、SVG の blob（ぼかしつき）で描く。帯にしない |
| 2 | 「まちナかぶんかさい」は専用のロゴタイプ | Noto Sans JP Bold の文字 | ロゴを SVG にして `<img alt="まちナかぶんかさい">` で置く |
| 3 | 白い手描きの線画（人物・風船・ガーランド・電球） | なし | 線画を SVG にして装飾に使う（`aria-hidden`） |
| 4 | チケットの形（角丸の枠・半円の切り欠き・点線のミシン目・大きな日付の半券） | 普通のカード | 開催情報のブロックをチケットの形にする（CSS の mask と `border-style: dashed` でできる） |

補足:
- 字間を広げたキャッチコピー（「夜のまち、みんなが輝く、舞台となれ。」）と丸い数字の日付も、チラシらしさを作っている。
- DADS との両立: 本文は Noto Sans JP のまま。ロゴ・日付などの表示用の文字だけを SVG にする。blob の上に文字を載せる箇所は、今の不透明度のルール（4.5:1）を守る。
- **人の作業が要る**: ロゴ・線画・チケットの枠は `.ai` の中にベクターで入っている。手元には PDF を画像化する手段（`sips`）しかないので、Illustrator で SVG に書き出す作業はデザイナーにお願いする。

## 2. 3つの前提の検証

### 2-1. 「45th-homepage（nutfes.net）はかなり最適化されている」 → 半分正しい

正しい部分（事実）:
- 画像: AVIF/WebP への変換、SP/PC での出し分け、`fetchPriority="high"`、50枚中49枚が `loading="lazy"`
- フォント: 自前で `unicode-range` ごとに分割した WOFF2 を、immutable キャッシュで配信している
- 第三者スクリプト（アナリティクス）を5秒遅らせ、カルーセルは画面に近づいてから読み込む
- Lighthouse を CI で回している

当たらない部分（2026-10-11 の実測）:
- トップの HTML は brotli 圧縮後でも 89KB ある。334KB の CSS をインラインで埋め込み、RSC payload も入っているため。
- JS は 20本・brotli 圧縮後で約312KB あり、学祭のサイトとしては重い。
- HTML と `_next/image` は Cloudflare でキャッシュされていない（`cf-cache-status: DYNAMIC`、`no-store`）。毎回のリクエストが Proxmox 上の Node まで届く。

参考にするべきは「画像・フォント・遅延読み込み」の作法で、アーキテクチャは参考にしない。

### 2-2. 「45th-homepage のような CMS を Workers だけで動かしたい」 → 前提に一つ誤りがある

**45th-homepage は Workers で動いていない。** 自前の Proxmox 上で Docker Compose により Next.js 16、Payload CMS 3、PostgreSQL、SeaweedFS(S3) を常駐させ、Cloudflare Tunnel で公開している。Worker を使っているのは、メンテナンス中に 503 を返す部分だけ。

「CMS みたいな機能」の正体は、Payload の管理画面 `/admin` である。お知らせ・企画・タイムテーブル・協賛・晴天/雨天の切り替えを、型つきで編集できる。保存すると hook がキャッシュを無効化するので、再ビルドは要らない。

### 2-3. 「Workers なら Next.js じゃない方がいい」 → 結論は妥当だが、理由が違う

- Next.js も Workers で動く（OpenNext のアダプタ `@opennextjs/cloudflare`）。「動かないから避ける」は誤り。
- 避ける理由は重さにある。中身がほぼ静的な学祭サイトで React のランタイムと hydration を配る必要はなく、静的な HTML/CSS をエッジから配るのが最も速い。今の `index.html` と `css/` もそのまま使える。
- **昨年のサイトが重かった原因は Next.js ではない**（`v0-yurumati-hp-dev` の調査結果、事実）。
  - 縦 30036px の PNG を CSS 背景に2枚使っている（11.5MB と 7.8MB）。CSS 背景なので最適化されず、原寸のまま配信されていた。
  - スクロールのたびに `setState` でページ全体（877行の client component）を再描画し、背景の位置を書き換えていた。
  - JS 自体は小さかった（page chunk 4.7KB）。
- つまり、フレームワークの選択より**アセットの規律**のほうが効く。どの構成を選んでも、下の「アセット規則」を必ず守る。

## 3. CMS の選定（前提: 編集者は git を使わない。出展者・広告を載せる。Workers で完結させる）

### 3-1. 「EmDash でもいいのでは」 → 条件に最も合う。ただし採用前に確かめることが2つある

事実（2026-10-11 時点の README・docs・issue）:
- 2026-09-28 に 1.0 として安定版を宣言し、最新は 1.2.0（2026-10-06）。semver を保証するのは core だけで、first-party の plugin はまだ 0.x。
- **Workers の無料プランで動く。** 有料プランが要るのは plugin のサンドボックス（Dynamic Workers）だけで、公式テンプレートはこの binding をコメントアウトした状態で配布されている。無料プランで本番運用しているサイトの記録もある（issue #3858）。
- 管理画面: コンテンツの型（出展者・広告・お知らせなど）を管理画面から作れる。画像は R2 にドラッグ＆ドロップでアップロードできる。下書き・予約公開・リビジョン、4段階の権限、パスキーと Google ログインに対応し、招待リンクも発行できる。**GitHub アカウントは要らない。**
- フロントは普通の Astro プロジェクトなので、今の HTML/CSS とデジタル庁デザインシステムのトークンをそのまま使える。

リスク:
- **CPU 10ms 上限**: 無料プランの上限。#3858 では、毎分の cron がこの上限で落ちていた（1.2.0 で修正済み）。公開ページは落ちていないが、起動時に読み込むコードは約 4.9MB ある。このサイトのページが上限に収まるかは、デプロイして `wrangler tail` で確かめるまで**未確定**。
- **日本語 UI**: 管理画面の文字列の約41%（3,384 中 1,384）が未翻訳。学生が迷わず使えるかは、実際に触ってもらって確かめる。
- **若さ**: 公開から半年で、更新が非常に速い（open の bug が63件）。**シーズン中はバージョンを固定する。**
- **画像変換**: Cloudflare Images の無料枠は月 5,000 変換。出展者が100件程度なら収まる見込み（推測）。

### 3-2. Payload は Workers の有料プランが必要か → 公式には「必要」。無料で動く根拠もない

- テンプレートの README は今も「This can only be deployed on Paid Workers right now due to size limits.」と書いている。
- ただし、その理由だった 3MB の圧縮サイズ上限は 2026-09-04 に撤廃された（無料・有料とも 64MiB）。README の理由はもう古い。
- それでも、管理画面（Next.js、OpenNext 経由）の SSR が無料プランの CPU 10ms に収まるかは、誰も検証していない。収まらない見込みが高い（推測）。
- 管理画面には Next.js が必須。公開側を Astro にしても、Next.js の Worker が別に要る。v4 の beta が 2026-10-09 に出たので、今 v3 で始めると近いうちに移行が発生する。
- → 今回の条件（無料、軽さ）には合わない。

### 3-3. 比較

| 案 | Workers 無料で完結 | 編集者に GitHub | 反映 | 主なリスク |
|---|---|---|---|---|
| **EmDash 1.2（plugin なし）** | ○（運用例あり） | 不要 | 即時 | CPU 10ms、日本語 UI が4割未翻訳、若い |
| Keystatic Cloud + Astro 静的 | サイトは ○、CMS は外部サービス | 不要 | 再ビルド 1〜3分（推測） | 無料は3人まで、画像アップロードは有料プラン |
| Pages CMS（ホスト版）+ Astro 静的 | サイトは ○、CMS は外部サービス | 不要（メール招待） | 再ビルド 1〜3分（推測） | 料金・日本語 UI は未確認 |
| Hono + D1 + R2 で自作 | ○ | 不要 | 即時 | 管理画面と認証を作って保守する手間 |
| Payload 3 | ×〜未検証 | 不要 | 即時 | Next.js 必須、v4 への移行 |
| Sveltia / Decap | ○ | **必要** | 1〜3分 | 条件に合わない |

**推奨: EmDash で小さく試し、2つの関門（CPU・日本語 UI）を通ったら本採用する。** 落ちた場合は Keystatic Cloud か Pages CMS と Astro の静的サイトの組み合わせに切り替える。サイト本体は静的配信になるので CPU の心配がなく、出展者・広告の型も作れる。

## 4. 「グラデーションとふにゃふにゃ」を体感させる UX

広く浅く22サイト・記事を調べた（日本のフェスサイト9件、海外のフェス3件、手法の記事・デモ10件）。条件は「CSS/SVG 中心で軽い」「デジタル庁の読みやすさを壊さない」。

### 取り入れるもの

| # | パターン | 参考 | 実装 | 注意 |
|---|---|---|---|---|
| 1 | 背景の blob 群がゆっくり漂う | Haikei（SVG を生成）、Quackit のメッシュグラデーション | 静的な SVG か `radial-gradient(in oklch, …)`。動きは `transform` だけで、15〜30秒の周期 | 広い面積に `filter: blur()` をかけない。本文の背後では暗くして 4.5:1 を保つ |
| 2 | 見出し・主要ボタンでグラデーションがゆっくり流れる | Josh Comeau「Magical Rainbow Button」 | `@property` で色を型付きの変数として登録し、`@keyframes` で動かす。補間は `in oklch` | 中間色が灰色に濁る問題（今の灰色の帯と同じ原因）は `oklch` の補間で避ける |
| 3 | ホバーでカードの縁がふにゃっと揺れる | CSS-Tricks「Three Ways to Blob」 | `:hover`/`:focus-visible` のときだけ `border-radius` を変える | タップ領域は 44px 以上のまま |
| 4 | 手描きの線画が振り子のように揺れる | **Start Your FUJI ROCK!**（最も近い手本） | 線画の SVG に `rotate` の `@keyframes` をかける。ホバー中はぷるぷる震わせる（`feTurbulence`） | SVG フィルタは小さい要素だけに使う |
| 5 | セクションの境目を波線にする | css-generators.com/wavy-shapes | CSS の `mask` と `radial-gradient`、またはインライン SVG | canvas は使わない（みなとみらい21 の逆） |
| 6 | 日付・会場をチケット型にする | チラシそのもの、COFFEE CITY FES. | `mask` で半券の丸い切り欠き、`dashed` でミシン目 | 日付は `<time>` のテキストで書く |
| 7 | スクロールで blob が膨らみ、形が変わる | ― | `animation-timeline: view()`。`@supports` で囲み、Firefox では動かない版を見せる | 動きは控えめにする |

全体の約束:
- `prefers-reduced-motion: reduce` のときはすべて止める。5秒以上動き続ける装飾には一時停止ボタンを付ける（Flow Festival が手本。WCAG 2.2.2）。調べた日本のフェスサイト5件はどれも `prefers-reduced-motion` を扱っていなかったので、ここが他との差になる。
- 採らないもの: WebGL・three.js・PIXI・matter.js・動画背景（昨年と同じ重さの方向）。カーソル追従の blob は約10行の JS でできるが、タッチ端末では意味がないので後回しにする。
- Safari は CSS の `d` プロパティ（SVG の path の変形）に非対応。形を変えるのは `border-radius` か SMIL で行う。

参考 URL（抜粋）:
- https://start-your.fujirockfestival.com/ 、https://popisyousakae.com/ 、https://2023.kouba-fes.jp/ 、https://coffee-city-fes.com/ 、https://www.flowfestival.com/en/
- https://www.joshwcomeau.com/css/make-beautiful-gradients/ 、https://www.joshwcomeau.com/react/rainbow-button/
- https://css-tricks.com/?p=334309 （blob）、https://css-tricks.com/?p=311126 （Squigglevision）
- https://css-generators.com/wavy-shapes/ 、https://haikei.app/

## 5. アセット規則（構成によらず守る）

- 画像は `<img>` + `srcset`/`sizes` で配り、AVIF/WebP にする。CSS 背景に写真や巨大な画像を使わない。
- 装飾（blob・線画・ロゴ）は SVG か CSS で描く。縦長の一枚絵にしない。
- スクロールに連動する JS を書かない。
- フォントは Noto Sans JP の 400/700 だけ。
- 地図の iframe は `loading="lazy"`。同じ要素を SP 用と PC 用で二重に置かない。
- 予算: トップページの JS 0〜20KB、HTML+CSS 50KB 以下（brotli 後）、LCP 画像 100KB 以下を目安にし、Lighthouse で確かめる。

## 6. 次の一手（案）

1. EmDash の Cloudflare テンプレートを無料プランにデプロイし、出展者・広告・お知らせの型を作る。今の CSS を Astro に移したトップページで、`exceededCpu` が出ないかを確かめる。
2. 運営の学生に管理画面で出展者を1件登録してもらい、日本語 UI で迷うかを見る。
3. 並行して、§1 のロゴ・線画を SVG に書き出し（デザイナーの作業）、§4 の 1・2・6 から作り込む。

## 出典
- 45th-homepage: https://github.com/NUTFes/45th-homepage（`94d560d`）、https://www.nutfes.net/ の実測
- 昨年版: https://github.com/TakuyaNakakura/v0-yurumati-hp-dev（`e24d6c1`）、https://yurumachi.vercel.app/ の実測
- EmDash: https://github.com/emdash-cms/emdash 、https://github.com/emdash-cms/emdash/issues/3858 、https://www.cmswire.com/digital-experience/cloudflare-releases-emdash-1-0-cms-with-decentralized-plugin-registry/
- Payload: https://github.com/payloadcms/payload/blob/main/templates/with-cloudflare-d1/README.md 、https://payloadcms.com/docs/getting-started/what-is-payload
- Workers の制限: https://developers.cloudflare.com/workers/platform/limits/ 、https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/
- Keystatic Cloud: https://keystatic.com/docs/cloud 、Pages CMS: https://pagescms.org/docs/configuration/collaborators/
