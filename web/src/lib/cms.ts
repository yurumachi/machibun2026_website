const { CMS_URL, CMS_TOKEN } = process.env;
if (!CMS_URL || !CMS_TOKEN) throw new Error("CMS_URL と CMS_TOKEN を環境変数か web/.env に設定する");

export interface Entry<T> {
	id: string;
	slug: string | null;
	data: T;
}

export interface MediaValue {
	width?: number;
	height?: number;
	alt?: string;
	meta: { storageKey: string };
}

async function get(path: string) {
	const res = await fetch(new URL(`/_emdash/api/content/${path}`, CMS_URL), {
		headers: { Authorization: `Bearer ${CMS_TOKEN}` },
	});
	if (!res.ok) throw new Error(`CMS の ${path} が ${res.status} を返した: ${await res.text()}`);
	return (await res.json()).data;
}

export async function list<T>(collection: string, year: number) {
	// 並べ替えは CMS に頼まない。REST API は、索引を作った項目でしか並べ替えられないため
	const q = new URLSearchParams({ status: "published", limit: "100", fieldFilters: JSON.stringify({ year }) });
	const { items, total } = await get(`${collection}?${q}`);
	// 続きのページを読む処理は書かない。1年の件数は 100 に届かないので、超えたら黙って切らずに止める
	if (items.length < total) throw new Error(`${collection} が ${total} 件あり、1回で読める 100 件を超えた`);
	return items as Entry<T>[];
}

// 一件を取る API（`{collection}/{id}`）の references は使わない。token を作った管理者には下書きの版を返すため
export async function refTitle(collection: string, id: string, relation: string, published: Set<string>) {
	const { children } = await get(`${collection}/${id}/references/${relation}/children`);
	return (children as { id: string; title: string }[]).find((c) => published.has(c.id))?.title;
}

export const ids = (entries: Entry<unknown>[]) => new Set(entries.map((e) => e.id));

export const mediaUrl = (m: MediaValue) => new URL(`/_emdash/api/media/file/${m.meta.storageKey}`, CMS_URL).href;
