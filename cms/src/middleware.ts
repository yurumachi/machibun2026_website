import { defineMiddleware } from "astro:middleware";
import { waitUntil } from "cloudflare:workers";
import { requestRebuild } from "./plugins/rebuild-web";

const MEDIA_REPLACE = /^\/_emdash\/api\/media\/[^/]+\/replace$/;

// プラグインのフックで受ける方法は採らない。写真の差し替えでは、EmDash のフックが一つも呼ばれないため
export const onRequest = defineMiddleware(async (context, next) => {
	const res = await next();
	if (context.request.method === "PUT" && res.ok && MEDIA_REPLACE.test(context.url.pathname)) {
		waitUntil(requestRebuild(console.warn).catch(console.error));
	}
	return res;
});
