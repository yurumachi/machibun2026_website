// `node src/lib/cms.check.ts` で動かす
import assert from "node:assert/strict";

process.env.CMS_URL ??= "http://localhost";
process.env.CMS_TOKEN ??= "check";
const { pageSlug } = await import("./cms.ts");

const id = "01M520X509ABYF875M98HTHGC6";
// 英数字の識別名は、そのまま URL に使う
assert.equal(pageSlug({ id, slug: "komeko-pan" }), "komeko-pan");
// 日本語の識別名も、そのまま URL に使う
assert.equal(pageSlug({ id, slug: "夜市の焼き菓子" }), "夜市の焼き菓子");
// 識別名が無ければ ID を使う
assert.equal(pageSlug({ id, slug: null }), id);
// URL の区切りになる文字や空白を含む識別名は、ID に替える
for (const slug of ["foo#bar", "foo?bar", "a/b", "50%off", "two words"]) assert.equal(pageSlug({ id, slug }), id, slug);
// 正規化すると別の識別名と同じになる識別名は、ID に替える
assert.equal(pageSlug({ id, slug: "café" }), id);
assert.equal(pageSlug({ id, slug: "café" }), "café");

console.log("ok");
