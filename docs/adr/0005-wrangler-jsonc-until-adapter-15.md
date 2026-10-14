# Worker の設定は、Astro と EmDash が対応するまで wrangler.jsonc に書き、対応したら cloudflare.config.ts に移る

wrangler のコマンドは打たない（AGENTS.md）。それでも設定は `wrangler.jsonc` に書く。

`cf` の設定ファイルは `cloudflare.config.ts` だが、いまの Astro のアダプター（`@astrojs/cloudflare` 14）はこれを読まず、`wrangler.jsonc` だけを読む。読むのは 15 から。15 は 2026-10 の時点でまだベータにあり、EmDash 1.2.0 は 14 を求めたうえ、設定を `wrangler.jsonc` からしか読まない（emdash-cms/emdash#3639）。いまは `site/wrangler.jsonc` 一つに書く。Worker の型は生成せず、`@cloudflare/workers-types` を使う。

アダプター 15 が正式に出て、EmDash がそれに対応したら、`cloudflare.config.ts` に移る。

## Considered Options

- `wrangler.jsonc` と `cloudflare.config.ts` を両方置く: 同じ設定を二か所に書くことになり、食い違いが起きるので採らなかった。
- いまアダプター 15 のベータに上げる: EmDash が対応しておらず、D1 の移行などが設定を見つけられなくなるので採らなかった。
- `wrangler types` で型を作る: wrangler のコマンドを打たない決まりに反するので採らなかった。

## 移る条件

- `@astrojs/cloudflare` 15 が正式版（ベータではない）で出ている。
- EmDash（`emdash`・`@emdash-cms/cloudflare`）がアダプター 15 を受け入れ、`cloudflare.config.ts` を読む（#3639 が閉じている）。

## 移るときにすること

1. `@astrojs/cloudflare` を 15 に、EmDash を対応した版に上げる。
2. `cloudflare.config.ts` を一から書く（`cf migrate` は使わない）。D1（`DB`）・KV（`MEDIA`・`SESSION`）・cron・ステージングを、`wrangler.jsonc` と同じ ID で書く。アダプター 14 が自動で足していた `SESSION` と `IMAGES` が、15 でも足されるかを確かめ、足されないなら書く。
3. `wrangler.jsonc` と、devDependencies の `wrangler`・`@cloudflare/workers-types` を消し、型は `cf workers types` で作る（`tsconfig.json` も合わせる）。
4. 手元のデータの置き場所が `site/.wrangler/` から変わるかを確かめ、変わるなら `.gitignore`・`compose.yaml`・HANDOVER の「手元で動かす」を直す。
5. AGENTS.md の `wrangler.jsonc` の項と、この ADR の状態を書き換える。

## Consequences

- `site/` で `cf deploy`・`cf build`・`cf dev` を打たない。`cloudflare.config.ts` が無いと、`cf` が自動で設定を作り、`astro.config.mjs` を書き換えようとする。
- EmDash を上げるたびに、#3639 と、EmDash が求めるアダプターの版を見る。
