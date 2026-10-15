import { env } from "cloudflare:workers";
import { EmDashStorageError } from "emdash";
import type { DownloadResult, ListOptions, ListResult, Storage, UploadResult } from "emdash";

interface Meta {
	contentType: string;
	size: number;
	uploaded: string;
}

class KVStorage implements Storage {
	constructor(private kv: KVNamespace) {}

	async upload(options: Parameters<Storage["upload"]>[0]): Promise<UploadResult> {
		try {
			// KV は ReadableStream もそのまま受け取れるが、大きさが分からないので一度読み切る
			const bytes =
				options.body instanceof ReadableStream ? new Uint8Array(await new Response(options.body).arrayBuffer()) : options.body;
			const meta: Meta = { contentType: options.contentType, size: bytes.byteLength, uploaded: new Date().toISOString() };
			await this.kv.put(options.key, bytes, { metadata: meta });
			return { key: options.key, url: this.getPublicUrl(options.key), size: bytes.byteLength };
		} catch (error) {
			throw new EmDashStorageError(`Failed to upload file: ${options.key}`, "UPLOAD_FAILED", error);
		}
	}

	// 範囲指定の読み出しは採らない。KV は範囲で読めず、Storage の約束では全体を返してよいため
	async download(key: string): Promise<DownloadResult> {
		const { value, metadata } = await this.read(key);
		if (!value || !metadata) throw new EmDashStorageError(`File not found: ${key}`, "NOT_FOUND");
		return {
			body: value,
			contentType: metadata.contentType,
			size: metadata.size,
			lastModified: new Date(metadata.uploaded),
		};
	}

	async delete(key: string): Promise<void> {
		try {
			await this.kv.delete(key);
		} catch (error) {
			throw new EmDashStorageError(`Failed to delete file: ${key}`, "DELETE_FAILED", error);
		}
	}

	async exists(key: string): Promise<boolean> {
		const { value } = await this.read(key);
		await value?.cancel();
		return value !== null;
	}

	async list(options: ListOptions = {}): Promise<ListResult> {
		try {
			const res = await this.kv.list<Meta>({ prefix: options.prefix, limit: options.limit, cursor: options.cursor });
			return {
				files: res.keys.map((k) => ({
					key: k.name,
					size: k.metadata?.size ?? 0,
					lastModified: new Date(k.metadata?.uploaded ?? 0),
				})),
				nextCursor: res.list_complete ? undefined : res.cursor,
			};
		} catch (error) {
			throw new EmDashStorageError("Failed to list files", "LIST_FAILED", error);
		}
	}

	async getSignedUploadUrl(): Promise<never> {
		throw new EmDashStorageError("KV does not support pre-signed upload URLs. Upload through the Worker.", "NOT_SUPPORTED");
	}

	getPublicUrl(key: string): string {
		return `/_emdash/api/media/file/${key}`;
	}

	private async read(key: string) {
		try {
			return await this.kv.getWithMetadata<Meta>(key, "stream");
		} catch (error) {
			throw new EmDashStorageError(`Failed to read file: ${key}`, "DOWNLOAD_FAILED", error);
		}
	}
}

export function createStorage(config: { binding?: unknown }): Storage {
	const binding = typeof config.binding === "string" ? config.binding : "";
	const kv = (env as unknown as Record<string, KVNamespace | undefined>)[binding];
	if (!kv) throw new EmDashStorageError(`KV binding "${binding}" not found in wrangler.jsonc`, "BINDING_NOT_FOUND");
	return new KVStorage(kv);
}
