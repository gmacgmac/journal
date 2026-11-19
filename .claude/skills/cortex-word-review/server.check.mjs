// Checks for the word-review server. Run: node --test .claude/skills/cortex-word-review/server.check.mjs
// Named .check.mjs, not .test.mjs, so a project's own test runner never picks it up from the
// skill mirrors. Starts the server on a free port against a temp folder and holds: rounds list,
// a row update persists to its file, the user's write can never change what the agent wrote, Send
// appends one signal line, the page source loads nothing from outside, each round and row keeps
// the date it first appeared, and Tick all is one write.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer, summarise } from "./server.mjs";

const PAGE = fileURLToPath(new URL("./page.html", import.meta.url));
const round = {
	round: "demo · R1 · Sample",
	items: [
		{ id: "A1", group: "g", order: 1, audience: "user", where: "a label", current: "Old", proposed: "New", ok: false, reply: "Because." },
		{ id: "A2", group: "g", order: 2, audience: "agent", where: "a hint", current: "Old two", proposed: "New two", ok: true, comment: "why?" },
	],
};
let dir = "";
let server;
let base = "";

const call = (method, path, body, headers = {}) =>
	fetch(base + path, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
const onDisk = () => JSON.parse(readFileSync(join(dir, "demo.json"), "utf8"));

before(async () => {
	dir = mkdtempSync(join(tmpdir(), "word-review-"));
	writeFileSync(join(dir, "demo.json"), JSON.stringify(round));
	const s = await startServer({ dir, port: 0 });
	server = s.server;
	base = `http://127.0.0.1:${s.port}`;
});
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

test("lists the rounds with their tally, and reads one whole", async () => {
	const list = await (await call("GET", "/api/rounds")).json();
	assert.deepEqual(list, [{ ...summarise("demo", round), added: list[0].added }]);
	const one = await (await call("GET", "/api/rounds/demo")).json();
	assert.deepEqual(one, { ...round, items: round.items.map((r, i) => ({ ...r, added: one.items[i].added })) });
	assert.equal((await call("GET", "/api/rounds/nope")).status, 404);
	assert.equal((await call("GET", "/api/rounds/..%2Fsignals")).status, 404);
});

test("a row update lands in the file and is stamped; the other row is untouched", async () => {
	const res = await call("PATCH", "/api/rounds/demo/items/A1", { ok: true, comment: "fine" });
	assert.equal(res.status, 200);
	const file = onDisk();
	assert.equal(file.items[0].ok, true);
	assert.equal(file.items[0].comment, "fine");
	assert.match(String(file.items[0].changedAt), /^\d{4}-\d\d-\d\dT/);
	assert.deepEqual(file.items[1], round.items[1]);
});

test("a write cannot change what the agent wrote", async () => {
	const res = await call("PATCH", "/api/rounds/demo/items/A1", { proposed: "Hijacked", reply: "Hijacked", where: "x", id: "Z9", yours: "My version" });
	assert.equal(res.status, 200);
	const row = onDisk().items[0];
	assert.equal(row.proposed, round.items[0].proposed);
	assert.equal(row.reply, round.items[0].reply);
	assert.equal(row.where, round.items[0].where);
	assert.equal(row.id, "A1");
	assert.equal(row.yours, "My version");
	assert.equal((await call("PATCH", "/api/rounds/demo/items/A1", { ok: "yes" })).status, 400);
	assert.equal((await call("PATCH", "/api/rounds/demo/items/ZZ", { ok: true })).status, 404);
});

test("concurrent updates to one file all survive", async () => {
	await Promise.all(["A1", "A2"].flatMap((id) => [call("PATCH", `/api/rounds/demo/items/${id}`, { comment: `note ${id}` }), call("PATCH", `/api/rounds/demo/items/${id}`, { yours: `mine ${id}` })]));
	const items = onDisk().items;
	assert.deepEqual(items.map((r) => [r.comment, r.yours]), [["note A1", "mine A1"], ["note A2", "mine A2"]]);
});

test("Send appends one line with the counts the file gives", async () => {
	const res = await call("POST", "/api/signal", { slug: "demo" });
	assert.equal(res.status, 200);
	const lines = readFileSync(join(dir, "signals.jsonl"), "utf8").split("\n").filter(Boolean);
	assert.equal(lines.length, 1);
	const s = summarise("demo", onDisk());
	const line = JSON.parse(lines[0]);
	assert.deepEqual(line, { at: line.at, round: s.round, ticked: s.ticked, of: s.of, edited: s.edited, comments: s.comments });
	assert.match(line.at, /^\d{4}-\d\d-\d\dT/);
	assert.equal((await call("POST", "/api/signal", { slug: "nope" })).status, 404);
});

test("another site cannot write here", async () => {
	assert.equal((await call("PATCH", "/api/rounds/demo/items/A1", { ok: false }, { origin: "http://evil.example" })).status, 403);
	const status = await new Promise((ok) => {
		const req = request(base + "/api/rounds", { headers: { host: "evil.example" } }, (res) => { res.resume(); ok(res.statusCode ?? 0); });
		req.end();
	});
	assert.equal(status, 403);
});

// Reads source, not behaviour (rule 18): a page that called another site would leak round text,
// and only the source can show it never does. The buttons themselves are proven in a browser.
test("the page source loads nothing from outside and is served as written", async () => {
	const html = await (await call("GET", "/")).text();
	const urls = [...html.matchAll(/(?:fetch|api)\(\s*(?:'[A-Z]+',\s*)?[`'"](https?:)?\/\//g)];
	assert.deepEqual(urls, []);
	assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href="https?:/, "no outside scripts or styles");
	assert.equal(readFileSync(PAGE, "utf8"), html);
});

test("a date is kept for each round and row, outside the round files, and old dates never move", async () => {
	const before = readFileSync(join(dir, "demo.json"), "utf8");
	const first = await (await call("GET", "/api/rounds/demo")).json();
	assert.match(first.items[0].added, /^\d{4}-\d\d-\d\dT/);
	assert.equal(readFileSync(join(dir, "demo.json"), "utf8"), before, "a read never writes to a round file");
	const data = onDisk();
	data.items.push({ id: "A3", group: "g", order: 3, where: "later", proposed: "Later" });
	writeFileSync(join(dir, "demo.json"), JSON.stringify(data));
	const stamps = JSON.parse(readFileSync(join(dir, ".added.json"), "utf8"));
	stamps.demo.rows.A1 = "2020-01-01T00:00:00.000Z";
	writeFileSync(join(dir, ".added.json"), JSON.stringify(stamps));
	const second = await (await call("GET", "/api/rounds/demo")).json();
	assert.equal(second.items[0].added, "2020-01-01T00:00:00.000Z", "a stored date stays");
	assert.match(second.items[2].added, /^\d{4}-\d\d-\d\dT/, "a row added later gets its own date");
	assert.equal(onDisk().items[2].added, undefined);
	const list = await (await call("GET", "/api/rounds")).json();
	assert.equal(list.length, 1, "the dates file is never listed as a round");
});

test("rounds list oldest first, by the date they were added and not by file name", async () => {
	writeFileSync(join(dir, "aaa-newer.json"), JSON.stringify({ round: "newer", items: [] }));
	const stamps = JSON.parse(readFileSync(join(dir, ".added.json"), "utf8"));
	stamps.demo.added = "2020-01-01T00:00:00.000Z";
	writeFileSync(join(dir, ".added.json"), JSON.stringify(stamps));
	const list = await (await call("GET", "/api/rounds")).json();
	assert.deepEqual(list.map((r) => r.slug), ["demo", "aaa-newer"]);
	assert.equal(list[0].added, "2020-01-01T00:00:00.000Z");
	rmSync(join(dir, "aaa-newer.json"));
});

test("Tick all is one write to one file, says what it missed, and can be undone", async () => {
	const ids = onDisk().items.map((r) => r.id);
	const res = await call("POST", "/api/rounds/demo/items:batchTick", { ids: [...ids, "ZZ"], ok: true });
	assert.equal(res.status, 200);
	assert.deepEqual(await res.json(), { done: ids, missing: ["ZZ"] });
	assert.ok(onDisk().items.every((r) => r.ok === true));
	await call("POST", "/api/rounds/demo/items:batchTick", { ids, ok: false });
	assert.ok(onDisk().items.every((r) => r.ok === false));
	assert.equal((await call("POST", "/api/rounds/demo/items:batchTick", { ids, ok: "yes" })).status, 400);
	assert.equal((await call("POST", "/api/rounds/demo/items:batchTick", { ids: "A1", ok: true })).status, 400);
	assert.equal((await call("POST", "/api/rounds/nope/items:batchTick", { ids, ok: true })).status, 404);
});
