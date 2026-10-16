# AI agent への指示

中身の設計は `docs/content-model.md`、言葉は `GLOSSARY.md`、決めた理由は `docs/adr/`、いまの作業の続きは `HANDOVER.md` にある。

## 始める前に

- `HANDOVER.md` を読み、続きから始める。用語は `GLOSSARY.md` の言い方にそろえる。
- ADR と食い違う変更が要りそうなら、手を動かす前に user に相談する。

## 環境

- コマンドはコンテナの中で動かす: `docker compose run --rm dev <コマンド>`（作業ディレクトリは `cms/`。公開サイトは `-w /work/web`、repo 全体で動かすときは `-w /work` を付ける）。`web/` のビルドは手元の CMS を読むので、動いている dev コンテナの中で `docker compose exec -w /work/web dev pnpm build` と打つ。ホストに Node や npm を入れない。
- Python もコンテナの中の `uv run` で動かす。
- Cloudflare の土台（D1・KV・Worker）は `cf` で扱い、wrangler を直接打たない。CMS の中身は MCP で扱う。
- Worker の設定は `cms/wrangler.jsonc` と `web/wrangler.jsonc` に書く。`cms/` のものは Astro のアダプターが、`web/` のものは Workers Builds の wrangler が読む。私たちは wrangler のコマンドを打たない。`cf` 用の `cloudflare.config.ts` には、Astro と EmDash が対応したら移る（ADR 0005）。
- 本番の D1・KV を直接書き換えない。試すのは手元か Preview（feat ブランチの確認用の環境）で行う。

## git

- `main` は保護されている。`feat/<内容>` のブランチを切り、PR で取り込む。
- commit と push は、user に言われたときだけ行う。
- commit メッセージは日本語で、1行目に何をしたか、本文になぜそうしたかを書く。
- commit・PR に、モデル名・`Co-Authored-By`・session の URL を入れない。
- `docs/*.ai` と `docs/*.pdf`（チラシの原本）は commit しない。

## 書き方

- 文書・commit・コメントは日本語で書く。
- コードのコメントには、あえて採らなかった方法とその理由だけを書く。
- 生成物は手で直さず、生成元を直して作り直す（例: `blobs.css` は `gen-blob-shapes.py` から作る）。
- 画面は WCAG 2.2 の AA に適合させる。値は `DESIGN.md`（デジタル庁デザインシステム）に従い、AA より厳しいところはそちらを採る（押せる部分は AA の 24px ではなく 44px）。

## 止まって聞くとき

- デプロイ、モックやプレビューの外部への公開、GitHub の設定の変更の前
- データやブランチを消す前
- 連絡先（個人情報）の置き場所や見せ方を変えるとき
