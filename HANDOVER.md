# 引き継ぎ: EmDash の試作

## いまの状態

- デザインのモック（`docs/prototype/mock/`）と、CMS に載せる中身の設計（`docs/content-model.md`・`GLOSSARY.md`・`docs/adr/`）までできている。
- 開発は Docker のコンテナで行う。`Dockerfile` と `compose.yaml` は用意済みで、Node 22・pnpm・uv（Python 3.13）が入る。ホストには Node を入れない。
- EmDash のサイトは `site/` に作る（まだ無い）。
- ブランチは `feat` と `main` だけ。`feat` ブランチで開発し、PR で `main` に取り込む。`develop` は作らない（1人で開発し、`feat` のプレビューで確かめられるため）。
- 環境は3つ。データはそれぞれ別で、つながない。
  - 手元（コンテナ）: 手元のファイルに保存されるデータ。seed から作り、いつでも作り直せる。
  - ステージング: 本番とは別の Worker と D1・R2。`feat` ごとのプレビューと、`main` と同じコードの決まった URL。運営のアカウントは作らず、画面に「ステージング」の帯を出す。
  - 本番: `main` に入ったら自動でデプロイする Worker と D1・R2。

## 次にやること

1. コンテナの中で EmDash を `site/` に作る。テンプレートは Cloudflare 向けの Starter。
   `docker compose run --rm -it -w /work dev pnpm create emdash@latest site`
   （質問には Cloudflare・Starter・pnpm を選ぶ。`site/` が空でないと聞かれたら続ける。node_modules の置き場所が先にできているだけ。対話が要るので user に打ってもらう）
   作ったら `cf` を `site/` の devDependencies に入れる（npm でしか配られていないため）。
2. `docs/content-model.md` のとおりに中身の種類（出展者・出演者・出演枠・ステージ・カテゴリ・協賛・お知らせ）を作る。
3. モックの CSS（`docs/prototype/css/`）を移したトップページを作る。
4. `docker compose up` で開き、http://localhost:4321 で動きを確かめる。
5. 本番用とステージング用の Worker を作り、`feat` のプレビューがステージングの D1・R2 につながるかを確かめる（本番と同じデータにつながるなら、設定を見直す）。
6. デプロイして、CPU の上限（無料プランは 10ms）を超えていないかをログで確かめる。

## 決まっていないこと

- デプロイ先の Cloudflare アカウント（個人かゆるまちの共用か）。手元の開発には要らない。
- 協賛のランク・見せ方・広告との分け方（`docs/content-model.md` の「決まっていないこと」）
