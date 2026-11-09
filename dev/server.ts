// A page to run the Journal by hand, outside nclite: `npm run dev`. Never shipped, never part of the plugin folder.
// The view is the real `mount` (served by Vite, so a change to src/view/ shows on reload) and the engine is the real
// `createEngine`, over `dev/data/` (gitignored). This file stands in for nclite's side of the contract: the routes as
// the person calls them, and the engine's `watch` as server-sent events. The page's half of the host is `dev/host.ts`.
//
// `dev/data/` is made on the first start from the sample days (tests/fixtures/days/), moved so the newest lands on
// yesterday, with gaps between, so the views have empty days and today has no page. Delete the folder to start again.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
import { scopeCss } from '../bin/scope-css.ts';
import { createEngine } from '../src/engine/engine.ts';
import { addDays, dateOfPath, dateTitle, dayPath, localToday } from '../src/format/index.ts';

const HOST = '127.0.0.1';
const PORT = 5193;
const HERE = import.meta.dirname;
const DATA = join(HERE, 'data');
const SAMPLES = join(HERE, '../tests/fixtures/days');
/** Days between one sample and the next older one, newest first, so the journal has gaps as a real one does. */
const GAPS = [1, 2, 1, 1, 3, 1, 2, 1, 1, 5, 1];

function seed(): void {
	if (existsSync(DATA)) return;
	const samples = (readdirSync(SAMPLES, { recursive: true }) as string[])
		.map((rel) => [dateOfPath(rel), rel] as const)
		.filter((s): s is readonly [string, string] => s[0] !== null)
		.sort(([a], [b]) => b.localeCompare(a));
	let date = addDays(localToday(), -1);
	samples.forEach(([, rel], i) => {
		const text = readFileSync(join(SAMPLES, rel), 'utf8').replace(/^# .*$/m, `# ${dateTitle(date)}`);
		const file = join(DATA, dayPath(date));
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, text);
		date = addDays(date, -(GAPS[i % GAPS.length] ?? 1));
	});
	console.log(`Seeded ${samples.length} sample days into dev/data/, the newest yesterday.`);
}

seed();
const engine = createEngine({ dir: DATA, name: () => 'dev/data', flags: {}, warn: (m) => console.warn(`[journal] ${m}`) });

async function bodyOf(req: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	for await (const c of req) chunks.push(c as Buffer);
	const text = Buffer.concat(chunks).toString('utf8');
	if (text === '') return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

/** `/api/journal/<path>`: the Journal's own routes, as nclite's pass-through calls them, with the person as caller. */
async function route(req: IncomingMessage, res: ServerResponse, rest: string): Promise<void> {
	const url = new URL(rest, 'http://dev.invalid/');
	const ctl = new AbortController();
	res.on('close', () => ctl.abort());
	const reply = await engine.route(
		{ method: req.method ?? 'GET', path: url.pathname.slice(1), query: url.searchParams, body: await bodyOf(req) },
		{ caller: { by: 'person' }, signal: ctl.signal },
	);
	if (reply === null) return void res.writeHead(404, { 'content-type': 'application/json' }).end('{"title":"Not found","status":404}');
	res.writeHead(reply.status, { 'content-type': 'application/json', ...(reply.headers ?? {}) }).end(JSON.stringify(reply.body));
}

/** `/api/events`: each change from the engine's `watch`, and `{}` first, as nclite's stream opens with a catch-up. */
function events(req: IncomingMessage, res: ServerResponse): void {
	res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
	const send = (ref: unknown) => res.write(`data: ${JSON.stringify(ref)}\n\n`);
	send({});
	const stop = engine.watch(send);
	req.on('close', stop);
}

const server = await createServer({
	configFile: false,
	root: HERE,
	logLevel: 'info',
	server: { host: HOST, port: PORT, strictPort: true, fs: { allow: [join(HERE, '..')] } },
	plugins: [scopeCss(join(HERE, '..', 'src', 'ui'), '.journal'), {
		name: 'journal-dev-host',
		configureServer(vite) {
			vite.middlewares.use((req, res, next) => {
				const path = req.url ?? '';
				if (path === '/api/events') return events(req, res);
				if (path.startsWith('/api/journal/')) {
					return void route(req, res, path.slice('/api/journal'.length)).catch((err: unknown) => {
						console.error(err);
						if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
						res.end('{"title":"The dev server failed","status":500}');
					});
				}
				next();
			});
		},
	}],
});
await server.listen();
console.log(`The Journal, on its own: http://${HOST}:${PORT}/`);
