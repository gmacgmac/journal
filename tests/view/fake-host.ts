// A host as nclite gives one to `mount` (the contract's `PluginHost`), with a small Journal engine behind its `api`: day
// files held as text, answered the way the spec's routes answer (a `Response`, whole days and `next`, problems with a
// status), with real keys and offsets from `src/format/`. Every call is recorded, and each answer can be changed.
import { dateTitle, daysBetween, keyedBlocks, localToday } from '../../src/format/index.ts';
import type { Day, Edit, RangeEdit } from '../../src/seam-types.ts';
import type { Chip, ConfirmAsk, PluginEvent, PluginHost, Ref } from '../../src/vendor/plugin-host/plugin-host.ts';
import { weekOf } from '../../src/view/dates.ts';
import { mountJournal } from '../../src/view/journal.ts';
import { newRoot, settle } from './fake-dom.ts';

/** The Monday that starts the week the view opens on. */
export const thisWeek = () => weekOf(localToday());

/** A day file: its date line, then the texts given, a blank line apart. */
export const fileOf = (date: string, ...texts: string[]) => `${[`# ${dateTitle(date)}`, ...texts].join('\n\n')}\n`;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function fakeHost() {
	const files = new Map<string, string>();
	const problems = new Map<string, string[]>();
	const calls = {
		gets: [] as string[], edits: [] as Edit[], chips: [] as Chip[], attached: [] as unknown[],
		notes: [] as [string, string | undefined][], asks: [] as ConfirmAsk[],
	};
	const listeners = new Set<(e: PluginEvent) => void>();
	const knobs = {
		/** The engine cannot be reached: every call rejects. */
		down: false,
		/** Days one `GET days` answers before it says `next`. */
		perAnswer: 100,
		/** Answers an edit; the default saves it. Return null to never answer. */
		edit: (e: Edit): Response | null => save(e),
		/** What `confirm` answers. */
		confirm: async (_ask: ConfirmAsk) => false,
	};

	function dayOf(date: string): Day {
		const text = files.get(date);
		const blocks = text === undefined ? [] : keyedBlocks(text);
		return { date, title: dateTitle(date), exists: text !== undefined, version: null, blocks, problems: problems.get(date) ?? [] };
	}

	function save(e: Edit): Response {
		if (e.op === 'entry') return json({ title: 'not in this fake', status: 400, code: 'unreadable' }, 400);
		const text = files.get(e.date) ?? '';
		if (text.slice(e.start, e.end) !== e.before) return json({ title: 'The page changed.', status: 409, code: 'changed', day: dayOf(e.date) }, 409);
		const after = e.op === 'insert' ? `${e.before}\n\n${e.text}` : e.after;
		files.set(e.date, text.slice(0, e.start) + after + text.slice(e.end));
		const undo: RangeEdit = { op: 'range', date: e.date, start: e.start, end: e.start + after.length, before: after, after: e.before };
		return json({ day: dayOf(e.date), undo });
	}

	const host: PluginHost = {
		async api(path, init) {
			if (knobs.down) throw new TypeError('fetch failed');
			if (init.method === 'POST' && path === 'edit') {
				const e = JSON.parse(String(init.body)) as Edit;
				calls.edits.push(e);
				const answer = knobs.edit(e);
				return answer ?? new Promise<Response>(() => {});
			}
			calls.gets.push(path);
			const q = new URLSearchParams(path.split('?')[1]);
			const from = q.get('from')!;
			const to = q.get('to')!;
			const days: Day[] = [];
			const n = daysBetween(from, to);
			for (let i = 0; i < Math.min(n, knobs.perAnswer); i += 1) days.push(dayOf(new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10)));
			const next = n > knobs.perAnswer ? new Date(Date.parse(from) + knobs.perAnswer * 86400000).toISOString().slice(0, 10) : undefined;
			return json(next === undefined ? { days } : { days, next });
		},
		events: (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
		chat: {
			attach: (key, chip) => void calls.attached.push([key, chip]),
			add: (chip) => void calls.chips.push(chip),
			send: async () => null,
			status: { now: 'idle', on: () => () => {} },
			reveal: () => {},
			hasLine: () => false,
		},
		settings: { get: () => undefined, on: () => () => {} },
		notify: (text, tone) => void calls.notes.push([text, tone]),
		confirm: (ask) => (calls.asks.push(ask), knobs.confirm(ask)),
		store: { get: () => null, set: () => {} },
		imageRoute: '/image',
	};
	const emit = (ref: Ref) => { for (const fn of listeners) fn({ plugin: 'journal', ref }); };
	return { host, files, problems, calls, listeners, knobs, emit, dayOf };
}

/** A journal mounted on a fake host, its first read drawn. */
export async function mounted(setup: (h: ReturnType<typeof fakeHost>) => void = () => {}) {
	const root = newRoot();
	const h = fakeHost();
	setup(h);
	const view = mountJournal(root, h.host);
	await settle();
	return { root, view, ...h };
}
