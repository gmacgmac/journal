// The person's routes (docs/specification/plugin.md § Routes), through nclite's pass-through: `GET days` and `POST edit`.
// Any other path is null (nclite's 404); any caller but the person is 403. A problem is `{ title, status, code, day? }`.
import type { EngineContext, EngineReply, EngineRequest } from '../vendor/plugin-host/plugin-host.ts';
import { isDate } from '../format/index.ts';
import type { DaysAnswer, EditAnswer, RouteProblem } from '../seam-types.ts';
import { applyEdit, isEdit } from '../store/index.ts';
import { DAYS_MAX_CHARS, MAX_RANGE_DAYS, dayOf, rangeProblem, readDays } from './days.ts';
import { problemText, word } from './words.ts';

export type Route = (req: EngineRequest, ctx: EngineContext) => Promise<EngineReply | null>;

const problem = (status: number, code: string, title: string, extra: Partial<RouteProblem> = {}, headers?: Record<string, string>): EngineReply => {
	const body: RouteProblem = { title, status, code, ...extra };
	return headers === undefined ? { status, body } : { status, body, headers };
};

const ok = (body: unknown): EngineReply => ({ status: 200, body });

function days(dir: string, query: URLSearchParams): EngineReply {
	const from = query.get('from');
	const to = query.get('to');
	const bad = rangeProblem(from, to, MAX_RANGE_DAYS);
	if (bad !== null || from === null || to === null) return problem(400, 'dates', word(bad ?? 'journal.problem.dates-form', { max: MAX_RANGE_DAYS }));
	const read = readDays(dir, from, to, DAYS_MAX_CHARS);
	const answer: DaysAnswer = { days: read.days.map((d) => dayOf(d.date, d.file)) };
	if (read.next !== undefined) answer.next = read.next;
	return ok(answer);
}

function edit(dir: string, body: unknown, wrote: (date: string) => void): EngineReply {
	let e = body;
	if (typeof e === 'string') {
		try {
			e = JSON.parse(e);
		} catch {
			e = null;
		}
	}
	if (!isEdit(e) || !isDate(e.date)) return problem(400, 'unreadable', word('journal.problem.unreadable'));
	const done = applyEdit(dir, e);
	if (!done.ok) {
		const title = done.problems !== undefined ? done.problems.map(problemText).join(' ') : word(done.say, done.vars);
		return done.status === 400 ? problem(400, done.code, title) : problem(done.status, done.code, title, { day: dayOf(e.date, done.file) });
	}
	wrote(e.date);
	const answer: EditAnswer = { day: dayOf(e.date, { state: 'text', text: done.text }), undo: done.undo };
	return ok(answer);
}

/** The routes over the data folder `dir`. `wrote` hears each day this engine saved, at once. */
export function createRoutes(dir: string, wrote: (date: string) => void, warn: (message: string) => void): Route {
	const routes: Record<string, { method: string; run: (req: EngineRequest, query: URLSearchParams) => EngineReply }> = {
		days: { method: 'GET', run: (_req, query) => days(dir, query) },
		edit: { method: 'POST', run: (req) => edit(dir, req.body, wrote) },
	};
	return async (req, ctx) => {
		// The path is after the plugin's prefix; a query left on it (the view's own `days?from=…`) is read as the query.
		const [name = '', inPath] = req.path.replace(/^\/+/, '').split('?', 2);
		const query = inPath === undefined ? req.query : new URLSearchParams(inPath);
		const r = Object.hasOwn(routes, name) ? routes[name]! : null;
		if (r === null) return null;
		if (req.method !== r.method) return problem(405, 'method', word('journal.problem.method'), {}, { Allow: r.method });
		if (ctx.caller?.by !== 'person') return problem(403, 'caller', word('journal.problem.caller'));
		try {
			return r.run(req, query);
		} catch (e) {
			warn(`journal: ${name} failed: ${(e as Error).message}`);
			return problem(500, 'failed', word('journal.problem.failed'));
		}
	};
}
