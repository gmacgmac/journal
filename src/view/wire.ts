// The Journal's own routes as the view calls them, through the host's `api` (spec § Routes): `GET days`, followed by
// `next` until the range is read, `GET pages`, one batch of older pages at a time, and `POST edit`. The host answers a fetch `Response`; this is the one place that turns
// one into what the view uses, and nothing here throws: an engine that cannot be reached, or answers something
// unreadable, is a refusal in the Journal's words.
import type { Day, DaysAnswer, Edit, EditAnswer, RouteProblem } from '../seam-types.ts';
import type { Transport } from '../vendor/plugin-host/plugin-host.ts';
import { say } from './words.ts';

export type { Block, Day, Edit, RangeEdit } from '../seam-types.ts';

/** What `POST edit` comes to: the day as it now is and the edit that undoes this one, or why not. */
export type EditResult =
	| ({ ok: true } & EditAnswer)
	| { ok: false; status: number; reason: string; day: Day | null };

/** What reading a range comes to: every day of it, in order, or why not. */
export type DaysResult = { ok: true; days: Day[] } | { ok: false; reason: string };

/** What one batch of pages comes to: days that have a page, newest first, and where to read on, or why not. */
export type PagesResult = { ok: true; days: Day[]; next: string | null } | { ok: false; reason: string };

export interface Routes {
	days(from: string, to: string): Promise<DaysResult>;
	pages(before: string, limit: number): Promise<PagesResult>;
	edit(e: Edit): Promise<EditResult>;
}

type Answer = { ok: true; body: unknown } | { ok: false; status: number; reason: string; day: Day | null };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One call: the parsed body of a 2xx, or the problem of anything else. */
async function call(api: Transport, path: string, init: RequestInit): Promise<Answer> {
	let res: Response;
	try {
		res = await api(path, init);
	} catch {
		return { ok: false, status: 0, reason: say('journal.view.unreachable'), day: null };
	}
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		return { ok: false, status: res.status, reason: say('journal.view.unreadable'), day: null };
	}
	if (res.ok) return { ok: true, body };
	const problem: Partial<RouteProblem> = isObject(body) ? body : {};
	return {
		ok: false,
		status: res.status,
		reason: typeof problem.title === 'string' && problem.title !== '' ? problem.title : say('journal.view.unreadable'),
		day: isObject(problem.day) ? problem.day as unknown as Day : null,
	};
}

export function createRoutes(api: Transport): Routes {
	return {
		/** Every day from `from` to `to`, read in as many parts as the engine answers them (`next`). */
		async days(from, to) {
			const days: Day[] = [];
			for (let at = from; ;) {
				const r = await call(api, `days?from=${at}&to=${to}`, { method: 'GET' });
				if (!r.ok) return r;
				const answer = r.body as Partial<DaysAnswer>;
				if (!isObject(answer) || !Array.isArray(answer.days)) return { ok: false, reason: say('journal.view.unreadable') };
				days.push(...answer.days);
				// A `next` that does not move on, or runs past the range, ends the read rather than loop on it.
				const next = answer.next;
				if (typeof next !== 'string' || next <= at || next > to) return { ok: true, days };
				at = next;
			}
		},
		/** The pages before `before`, newest first; `next` the date to read on before, null when none are left. */
		async pages(before, limit) {
			const r = await call(api, `pages?before=${before}&limit=${limit}`, { method: 'GET' });
			if (!r.ok) return r;
			const answer = r.body as Partial<DaysAnswer>;
			if (!isObject(answer) || !Array.isArray(answer.days)) return { ok: false, reason: say('journal.view.unreadable') };
			// A `next` that does not move back ends the list rather than loop on it.
			const next = typeof answer.next === 'string' && answer.next < before ? answer.next : null;
			return { ok: true, days: answer.days, next };
		},
		async edit(e) {
			const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e) };
			const r = await call(api, 'edit', init);
			if (!r.ok) return r;
			const answer = r.body as Partial<EditAnswer>;
			if (!isObject(answer) || !isObject(answer.day) || !isObject(answer.undo)) {
				return { ok: false, status: 200, reason: say('journal.view.unreadable'), day: null };
			}
			return { ok: true, day: answer.day, undo: answer.undo };
		},
	};
}
