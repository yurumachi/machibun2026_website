import { defineMiddleware } from "astro:middleware";
import { env, waitUntil } from "cloudflare:workers";
import { requestRebuild } from "./plugins/rebuild-web";

const MEDIA_REPLACE = /^\/_emdash\/api\/media\/[^/]+\/replace$/;
// PUBLIC_SITE_URL に preview が入っているかで見分ける方法は採らない。URL を変えたときに黙って出なくなるため
const PREVIEW_BADGE = `<div style="position:fixed;inset:0;z-index:2147483647;pointer-events:none;border:4px solid #b45309"><span style="position:absolute;top:0;left:50%;transform:translateX(-50%);padding:0 10px;background:#b45309;color:#fff;font:700 14px/1.5 sans-serif;border-radius:0 0 6px 6px">Preview（確認用）</span></div>`;

// プラグインのフックで受ける方法は採らない。写真の差し替えでは、EmDash のフックが一つも呼ばれないため
// 言語の Cookie を応答に付けるだけにする方法は採らない。EmDash は届いた要求の Cookie で言語を選ぶので、最初の1回が英語のまま出るため
export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	if (context.request.method === "GET" && pathname.startsWith("/_emdash/admin") && !context.cookies.has("emdash-locale")) {
		context.cookies.set("emdash-locale", "ja", { path: "/_emdash", sameSite: "lax", maxAge: 31536000, secure: context.url.protocol === "https:" });
		return context.redirect(pathname + context.url.search);
	}
	const res = await next();
	if (context.request.method === "PUT" && res.ok && MEDIA_REPLACE.test(pathname)) {
		waitUntil(requestRebuild(console.warn).catch(console.error));
	}
	if ((env as { PREVIEW?: string }).PREVIEW && res.headers.get("content-type")?.startsWith("text/html")) {
		return new HTMLRewriter().on("body", { element: (body) => void body.append(PREVIEW_BADGE, { html: true }) }).transform(res);
	}
	return res;
});
