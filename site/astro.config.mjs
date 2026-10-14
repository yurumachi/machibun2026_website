import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { fileURLToPath } from "node:url";
import { d1 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			// R2 は採らない。このアカウントで R2 を有効にすると支払い方法の登録が要るため（ADR 0004）
			storage: {
				entrypoint: fileURLToPath(new URL("./src/storage/kv.ts", import.meta.url)),
				config: { binding: "MEDIA" },
			},
		}),
	],
	devToolbar: { enabled: false },
});
