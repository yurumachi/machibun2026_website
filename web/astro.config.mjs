import { existsSync } from "node:fs";
import { defineConfig } from "astro/config";

// vite の loadEnv は採らない。web の依存に vite を足すことになるため
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
	output: "static",
	image: {
		// どのホストの写真でも縮める設定は採らない。CMS 以外の URL を取りに行かないため
		domains: [new URL(process.env.CMS_URL).hostname],
		layout: "constrained",
		responsiveStyles: true,
	},
	devToolbar: { enabled: false },
});
