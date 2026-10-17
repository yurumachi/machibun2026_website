# 作業は feat → preview → main の順に取り込み、Preview は preview ブランチの1組だけにする

作業ブランチ（`feat/<内容>`）は、まず長く残す `preview` ブランチに PR で取り込み、`preview` で確かめてから `main` に PR で取り込む。Preview として Cloudflare に出すのは `preview` ブランチだけで、管理画面の Preview（`preview-machibun-cms`）と公開サイトの Preview（`preview-machibun2026`）が1対1で対になる。

理由は、Preview の CMS が1つしかないことだ。Preview の D1・KV は `cms/wrangler.jsonc` の `previews` に書き、すべての Preview で共有する。公開サイトの Preview は、ビルドのときにこの CMS を読んで静的なファイルにする（ADR 0006）。Preview の CMS で公開したときに Deploy Hook がビルドし直せるのは、Hook を作ったときに決めた1つのブランチだけだ。作業ブランチごとに公開サイトの Preview を出すと、どれをビルドし直すかが決まらない。

Preview の公開サイトは、Cloudflare Access で見られる人を絞る。

## Considered Options

- 作業ブランチごとに Preview を出し、Preview の CMS の Hook を作業中のブランチに付け替える: ブランチを切るたびに Hook を作り、Preview の secret を画面で入れ直し（`cf` に入れるコマンドが無い）、管理画面の Preview を作り直すことになる。複数人で同時に作業すると、付け替えが取り合いになるので採らなかった。
- 作業ブランチごとに Preview を出し、Preview の CMS で公開したら開いている PR のブランチを全部ビルドし直す（Hook の代わりに Workers Builds の API を呼ぶ）: 公開のたびにブランチの数だけビルドが走る。ビルドを動かせる token を Preview の CMS に置き、ブランチを数えるコードも要るので採らなかった。
- 作業ブランチごとに D1 と管理画面を分ける: `previews` の設定は全ブランチで1つなので、ブランチごとに設定を書き換え、D1・KV を作ってデータを写すことになる。パスキーは管理画面のホスト名に結び付くので、ブランチごとに管理者を作り直すことにもなる。Hook をどのブランチに向けるかも解決しないので採らなかった。
- 作業ブランチごとに Preview を出し、Preview の CMS の中身を変えたら手でビルドし直す: 手作業が残るので採らなかった。

## Consequences

- 中身を何度も変えて見た目を確かめる作業は、手元の開発サーバーで行う（ページを開くたびに CMS を読み直すので、ビルドが要らない）。Preview は、人に見せたりスマホで確かめたりするために使う。
- 2つの Worker の Preview 用のビルドの設定は、`preview` ブランチのときだけビルドとデプロイをする。Preview 用の設定のブランチの絞り込みは「main 以外の全部」から変えられないので、コマンドの中で `WORKERS_CI_BRANCH` を見て止める。作業ブランチを push すると、Workers Builds がそのブランチの Preview の URL を自動で作るが、ビルドはしない。その URL が何を返すかは確かめていない。ブランチを消すと、その Preview も自動で消える。
- `preview` を `main` に取り込むと、`preview` にあるものが全部本番に出る。やめた作業は `preview` で revert してから `main` に取り込む。
- `preview` から `main` へは merge commit で取り込む（squash しない）。squash すると `preview` と `main` の履歴が分かれ、次の取り込みで同じ変更が食い違う。
- `main` に直接入れた直し（急ぎのもの）があれば、`main` を `preview` に取り込んで追いつかせる。
- コレクションや項目を変える変更は、本番より先に Preview の CMS の D1 で試される。
- Access は公開サイトの Preview にだけかける。管理画面の Preview はパスキーで守られているうえ、公開サイトの Preview のビルドがその API を読むので、Access をかけるとビルドが止まる。本番も `workers.dev` で出しているので、`workers.dev` 全体にはかけない。
