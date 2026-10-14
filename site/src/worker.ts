import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";

export { PluginBridge };

export default {
	...handler,
	async fetch(request, env, ctx) {
		const response = await handler.fetch!(request, env, ctx);
		if (response.webSocket || response.headers.has("Cache-Control") || response.headers.has("Cloudflare-CDN-Cache-Control")) {
			return response;
		}
		// ヘッダーの無いままにはしない。Workers Caching は Cache-Control の無い 200 を2時間保存するので、ログイン中の人に返したページが他の人に出うる
		const uncached = new Response(response.body, response);
		uncached.headers.set("Cache-Control", "private, no-store");
		return uncached;
	},
	scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
