// The word-review server: serves page.html and a small JSON API over the round files in
// cortex-tasks/word-review/. Zero dependencies, plain JavaScript, any Node 18 or newer.
// Run from the project root: node .claude/skills/cortex-word-review/server.mjs
// (any mirror of the skill works: .kiro/, .agent/ or .claude/).
//
// It only ever changes the user's fields on a row (ok, yours, comment, changedAt). Everything
// the agent writes (proposed, reply, where, ...) is edited in the files directly and is never
// touched here. The date each round and row first appeared is kept beside them in .added.json,
// which only this server writes, so nobody adding a row has to remember it.
//
// Settings (environment): WORD_REVIEW_PORT (default 3390), WORD_REVIEW_DIR (default
// cortex-tasks/word-review at the project root).
import { createServer } from "node:http";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {Record<string, unknown> & { id: string, proposed: string, ok?: boolean, yours?: string, comment?: string }} Row */
/** @typedef {{ round: string, items: Row[] }} Round */
/** @typedef {{ slug: string, round: string, of: number, ticked: number, edited: number, comments: number }} Summary */

const HERE = dirname(fileURLToPath(import.meta.url));
// The skill sits three levels down in every mirror (.kiro/skills/<name>/), so this is the project root.
const DEFAULT_DIR = resolve(HERE, "../../../cortex-tasks/word-review");
const DEFAULT_PORT = 3390;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const MAX_BODY = 1_000_000;
const MAX_TEXT = 20_000;

/** The user wrote their own version, and it differs from the proposal. */
const mine = (/** @type {Row} */ r) => (r.yours ?? "").trim() !== "" && r.yours !== r.proposed;

/** @returns {Summary} */
export function summarise(/** @type {string} */ slug, /** @type {Round} */ data) {
	const items = data.items;
	return {
		slug,
		round: data.round,
		of: items.length,
		ticked: items.filter((r) => r.ok || mine(r)).length,
		edited: items.filter(mine).length,
		comments: items.filter((r) => (r.comment ?? "").trim() !== "").length,
	};
}

class HttpError extends Error {
	constructor(/** @type {number} */ status, /** @type {string} */ message) {
		super(message);
		this.status = status;
	}
}

/** @returns {Promise<{ server: import("node:http").Server, port: number, dir: string }>} */
export function startServer(/** @type {{ dir?: string, port?: number }} */ opts = {}) {
	const dir = opts.dir ?? DEFAULT_DIR;
	mkdirSync(dir, { recursive: true });
	const signals = join(dir, "signals.jsonl");
	const addedFile = join(dir, ".added.json"); // its name fails SLUG, so it is never read as a round
	/** @type {Map<string, Promise<unknown>>} */
	const queues = new Map(); // one write at a time per file

	const fileOf = (/** @type {string} */ slug) => {
		if (!SLUG.test(slug)) throw new HttpError(404, "No such round.");
		const file = join(dir, `${slug}.json`);
		if (!existsSync(file)) throw new HttpError(404, "No such round.");
		return file;
	};
	/** @returns {Round} */
	const readRound = (/** @type {string} */ slug) => JSON.parse(readFileSync(fileOf(slug), "utf8"));
	const writeJson = (/** @type {string} */ file, /** @type {unknown} */ data) => {
		const tmp = `${file}.${process.pid}.tmp`;
		writeFileSync(tmp, JSON.stringify(data, null, "\t") + "\n");
		renameSync(tmp, file); // atomic: a reader sees the old file or the new one, never half
	};
	// The date of anything not seen before is now; a date already stored never moves.
	const stampAdded = (/** @type {{ slug: string, data: Round }[]} */ seen) => {
		/** @type {Record<string, { added: string, rows: Record<string, string> }>} */
		const added = existsSync(addedFile) ? JSON.parse(readFileSync(addedFile, "utf8")) : {};
		const now = new Date().toISOString();
		let changed = false;
		for (const { slug, data } of seen) {
			if (!added[slug]) { added[slug] = { added: now, rows: {} }; changed = true; }
			const entry = added[slug];
			for (const row of data.items) if (!entry.rows[row.id]) { entry.rows[row.id] = now; changed = true; }
		}
		if (changed) writeJson(addedFile, added);
		return added;
	};
	/** @template T @returns {Promise<T>} */
	const serialised = (/** @type {string} */ slug, /** @type {() => T} */ job) => {
		const run = (queues.get(slug) ?? Promise.resolve()).then(job);
		queues.set(slug, run.catch(() => {}));
		return run;
	};
	const slugs = () =>
		readdirSync(dir)
			.filter((f) => f.endsWith(".json"))
			.map((f) => f.slice(0, -5))
			.filter((s) => SLUG.test(s))
			.sort();

	// The user's fields only. Anything else in the body is ignored.
	const patchRow = (/** @type {string} */ slug, /** @type {string} */ id, /** @type {Record<string, unknown>} */ body) =>
		serialised(slug, () => {
			const file = fileOf(slug);
			const data = readRound(slug);
			const row = data.items.find((r) => r.id === id);
			if (!row) throw new HttpError(404, "No such row.");
			if ("ok" in body) {
				if (typeof body.ok !== "boolean") throw new HttpError(400, "ok must be true or false.");
				row.ok = body.ok;
			}
			for (const key of /** @type {const} */ (["yours", "comment"])) {
				if (!(key in body)) continue;
				const v = body[key];
				if (typeof v !== "string" || v.length > MAX_TEXT) throw new HttpError(400, `${key} must be text.`);
				row[key] = v;
			}
			row.changedAt = new Date().toISOString();
			writeJson(file, data);
			return row;
		});

	const batchTick = (/** @type {string} */ slug, /** @type {Record<string, unknown>} */ body) =>
		serialised(slug, () => {
			const { ids, ok } = body;
			if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) throw new HttpError(400, "ids must be a list.");
			if (typeof ok !== "boolean") throw new HttpError(400, "ok must be true or false.");
			const file = fileOf(slug);
			const data = readRound(slug);
			const rows = data.items.filter((r) => ids.includes(r.id));
			const changedAt = new Date().toISOString();
			for (const row of rows) { row.ok = ok; row.changedAt = changedAt; }
			writeJson(file, data);
			const done = rows.map((r) => r.id);
			return { done, missing: ids.filter((id) => !done.includes(id)) };
		});

	const signal = (/** @type {string} */ slug) =>
		serialised(slug, () => {
			const s = summarise(slug, readRound(slug));
			const line = { at: new Date().toISOString(), round: s.round, ticked: s.ticked, of: s.of, edited: s.edited, comments: s.comments };
			appendFileSync(signals, JSON.stringify(line) + "\n");
			return line;
		});

	/** @returns {Promise<Record<string, unknown>>} */
	const readBody = (/** @type {import("node:http").IncomingMessage} */ req) =>
		new Promise((ok, fail) => {
			/** @type {Buffer[]} */
			const chunks = [];
			let size = 0;
			req.on("data", (/** @type {Buffer} */ c) => {
				size += c.length;
				if (size > MAX_BODY) { fail(new HttpError(413, "Too large.")); req.destroy(); return; }
				chunks.push(c);
			});
			req.on("end", () => {
				try {
					const v = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
					if (v && typeof v === "object" && !Array.isArray(v)) ok(v);
					else fail(new HttpError(400, "Send a JSON object."));
				} catch { fail(new HttpError(400, "Send valid JSON.")); }
			});
			req.on("error", fail);
		});

	const send = (/** @type {import("node:http").ServerResponse} */ res, /** @type {number} */ status, /** @type {unknown} */ body, type = "application/json") => {
		res.writeHead(status, { "content-type": type + "; charset=utf-8", "cache-control": "no-store" });
		res.end(type === "application/json" ? JSON.stringify(body) : String(body));
	};

	async function handle(/** @type {import("node:http").IncomingMessage} */ req, /** @type {import("node:http").ServerResponse} */ res, /** @type {number} */ port) {
		// A page on another site must not be able to write here: same host and origin only.
		const host = req.headers.host ?? "";
		if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) throw new HttpError(403, "Wrong host.");
		const write = req.method !== "GET";
		if (write && req.headers.origin && req.headers.origin !== `http://${host}`) throw new HttpError(403, "Wrong origin.");
		if (write && !String(req.headers["content-type"] ?? "").startsWith("application/json")) throw new HttpError(415, "Send JSON.");

		const path = new URL(req.url ?? "/", "http://x").pathname;
		if (req.method === "GET" && path === "/") return send(res, 200, readFileSync(join(HERE, "page.html"), "utf8"), "text/html");
		if (req.method === "GET" && path === "/api/rounds") {
			const seen = slugs().flatMap((slug) => { try { return [{ slug, data: readRound(slug) }]; } catch { return []; } });
			const added = stampAdded(seen);
			const listed = seen.map(({ slug, data }) => ({ ...summarise(slug, data), added: added[slug].added }));
			return send(res, 200, listed.sort((a, b) => a.added.localeCompare(b.added) || a.slug.localeCompare(b.slug)));
		}
		const one = path.match(/^\/api\/rounds\/([^/]+)$/);
		if (req.method === "GET" && one) {
			const data = readRound(one[1]);
			const dates = stampAdded([{ slug: one[1], data }])[one[1]].rows;
			return send(res, 200, { ...data, items: data.items.map((r) => ({ ...r, added: dates[r.id] })) });
		}
		const batch = path.match(/^\/api\/rounds\/([^/]+)\/items:batchTick$/);
		if (req.method === "POST" && batch) return send(res, 200, await batchTick(batch[1], await readBody(req)));
		const row = path.match(/^\/api\/rounds\/([^/]+)\/items\/([^/]+)$/);
		if (req.method === "PATCH" && row) return send(res, 200, await patchRow(row[1], decodeURIComponent(row[2]), await readBody(req)));
		if (req.method === "POST" && path === "/api/signal") {
			const body = await readBody(req);
			fileOf(String(body.slug ?? ""));
			return send(res, 200, await signal(String(body.slug)));
		}
		throw new HttpError(404, "Not found.");
	}

	return new Promise((ok, fail) => {
		let port = 0;
		const server = createServer((req, res) => {
			handle(req, res, port).catch((e) => {
				if (e instanceof HttpError) send(res, e.status, { error: e.message });
				else { console.error(e); send(res, 500, { error: "Something went wrong in the review server." }); }
			});
		});
		server.once("error", fail);
		server.listen(opts.port ?? DEFAULT_PORT, "127.0.0.1", () => {
			port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;
			ok({ server, port, dir });
		});
	});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const want = Number(process.env.WORD_REVIEW_PORT ?? DEFAULT_PORT);
	startServer({ port: want, dir: process.env.WORD_REVIEW_DIR ? resolve(process.env.WORD_REVIEW_DIR) : undefined }).then(
		({ port, dir }) => console.log(`Word review: http://127.0.0.1:${port}/  (rounds in ${dir})`),
		(e) => {
			console.error(e.code === "EADDRINUSE" ? `Port ${want} is already in use. Stop the other review server, or set WORD_REVIEW_PORT.` : e.message);
			process.exit(1);
		},
	);
}
