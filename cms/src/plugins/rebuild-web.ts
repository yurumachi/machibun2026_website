import { env } from "cloudflare:workers";
import { definePlugin } from "emdash";

export async function requestRebuild(warn: (msg: string) => void) {
	const url = (env as { DEPLOY_HOOK_URL?: string }).DEPLOY_HOOK_URL;
	if (!url) {
		warn("DEPLOY_HOOK_URL が無いので、公開サイトをビルドし直さない");
		return;
	}
	const res = await fetch(url, { method: "POST" });
	if (!res.ok) throw new Error(`公開サイトの Deploy Hook が ${res.status} を返した`);
}

const rebuild = (_event: unknown, ctx: { log: { warn: (msg: string) => void } }) =>
	requestRebuild((msg) => ctx.log.warn(msg));

export function createPlugin() {
	return definePlugin({
		id: "rebuild-web",
		version: "0.1.0",
		capabilities: ["content:read"],
		hooks: {
			"content:afterPublish": rebuild,
			"content:afterUnpublish": rebuild,
			"content:afterDelete": rebuild,
			"content:afterRestore": rebuild,
			// 保存のたびには呼ばない。下書きの版がある種類は、保存しても公開中の中身が変わらないため
			"content:afterSave": async (event, ctx) => {
				if (event.content.status === "published" && !event.content.draftRevisionId) await rebuild(event, ctx);
			},
		},
	});
}
