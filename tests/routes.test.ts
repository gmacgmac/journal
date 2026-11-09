// The person's routes (docs/specification/plugin.md § Routes), through `createEngine` as nclite calls it.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createEngine } from '../src/engine/engine.ts';
import { DAYS_MAX_CHARS, MAX_PAGES, MAX_RANGE_DAYS, PAGES_DEFAULT, dayOf, readDays, readPages } from '../src/engine/days.ts';
import { MAX_DAY_BYTES, addDays, blocksOf, dateHeading, datesBetween, keyedBlocks } from '../src/format/index.ts';
import type { DaysAnswer, Edit, EditAnswer, RouteProblem } from '../src/seam-types.ts';
import { dayFile, version, writeDay } from '../src/store/index.ts';
import type { Caller, EngineReply } from '../src/vendor/plugin-host/plugin-host.ts';
import { sampleDays, scratch } from './fixtures/days.ts';

const DATE = '2026-10-01';
const PERSON: Caller = { by: 'person' };

function engineOn(t: { after: (fn: () => void) => void }, empty = false) {
	const { dir, done } = scratch(empty);
	t.after(done);
	const warned: string[] = [];
	const engine = createEngine({ dir, name: () => 'A bot', warn: (m) => warned.push(m), flags: {} });
	const call = async (method: string, path: string, body?: unknown, caller: Caller = PERSON): Promise<EngineReply | null> => {
		const [p = '', q = ''] = path.split('?');
		return engine.route({ method, path: p, query: new URLSearchParams(q), body }, { caller, signal: new AbortController().signal });
	};
	const edit = async (e: unknown) => (await call('POST', 'edit', e))!;
	return { dir, engine, call, edit, warned, read: (date = DATE) => readFileSync(dayFile(dir, date), 'utf8') };
}

const replaceAt = (text: string, index: number, after: string): Extract<Edit, { op: 'replace' }> => {
	const b = blocksOf(text)[index]!;
	return { op: 'replace', date: DATE, start: b.start, end: b.end, before: b.text, after };
};

describe('GET pages', () => {
	it('pages answers only the days that have a page, newest first, before a date, and says where to read on', async (t) => {
		const { call } = engineOn(t);
		const sample = sampleDays().map(([date]) => date).reverse();
		const r = (await call('GET', `pages?before=2026-10-05&limit=3`))!;
		assert.equal(r.status, 200);
		const { days, next } = r.body as DaysAnswer;
		const expected = sample.filter((d) => d < '2026-10-05').slice(0, 3);
		assert.deepEqual(days.map((d) => d.date), expected);
		assert.ok(days.every((d) => d.exists));
		assert.equal(next, expected.at(-1));
		const rest = (await call('GET', `pages?before=${next}&limit=${MAX_PAGES}`))!.body as DaysAnswer;
		assert.deepEqual(rest.days.map((d) => d.date), sample.filter((d) => d < next!));
		assert.equal(rest.next, undefined, 'the oldest page ends the list');
	});

	it('pages gives PAGES_DEFAULT when not told how many, none for an empty journal, and refuses a bad date or limit', async (t) => {
		const { call } = engineOn(t);
		const all = (await call('GET', 'pages?before=2030-01-01'))!.body as DaysAnswer;
		assert.equal(all.days.length, Math.min(PAGES_DEFAULT, sampleDays().length));
		for (const bad of ['pages', 'pages?before=2026-13-01', 'pages?before=2026-10-05&limit=0', `pages?before=2026-10-05&limit=${MAX_PAGES + 1}`, 'pages?before=2026-10-05&limit=two']) {
			const r = (await call('GET', bad))!;
			assert.equal(r.status, 400, bad);
			assert.ok(['dates', 'limit'].includes((r.body as RouteProblem).code), bad);
		}
		const empty = engineOn(t, true);
		assert.deepEqual((await empty.call('GET', 'pages?before=2030-01-01'))!.body, { days: [] });
	});

	it('pages stops at the budget, always gives one day, and says next', (t) => {
		const { dir } = engineOn(t);
		const r = readPages(dir, '2030-01-01', MAX_PAGES, { chars: 1, bytes: Infinity }, dayOf);
		assert.equal(r.days.length, 1);
		assert.equal(r.next, r.days[0]!.date);
	});
});

describe('GET days', () => {
	it('days answers every day in the range, gaps included, and refuses a bad range', async (t) => {
		const { call, read } = engineOn(t);
		const r = (await call('GET', 'days?from=2026-09-29&to=2026-10-05'))!;
		assert.equal(r.status, 200);
		const { days, next } = r.body as DaysAnswer;
		assert.equal(next, undefined);
		assert.deepEqual(days.map((d) => d.date), datesBetween('2026-09-29', '2026-10-05'));
		const gap = days.find((d) => d.date === '2026-10-03')!;
		assert.deepEqual(gap, { date: '2026-10-03', title: 'Saturday 3 October 2026', exists: false, version: null, blocks: [], problems: [] });
		const one = days.find((d) => d.date === DATE)!;
		assert.deepEqual(one, { date: DATE, title: 'Thursday 1 October 2026', exists: true, version: version(read()), blocks: keyedBlocks(read()), problems: [] });
		for (const q of ['from=2026-10-05&to=2026-10-01', `from=2026-01-01&to=${addDays('2026-01-01', MAX_RANGE_DAYS)}`, 'from=2026-10-01&to=../../etc', 'from=2026-10-01', '']) {
			const bad = (await call('GET', `days?${q}`))!;
			assert.equal(bad.status, 400, q);
			assert.equal((bad.body as RouteProblem).code, 'dates', q);
			assert.equal((bad.body as RouteProblem).status, 400, q);
		}
		assert.equal((await call('GET', `days?from=2026-01-01&to=${addDays('2026-01-01', MAX_RANGE_DAYS - 1)}`))!.status, 200);
	});

	it('days stops before DAYS_MAX_CHARS, always gives one day, and says next', async (t) => {
		const { call, dir } = engineOn(t, true);
		const big = (date: string) => `${dateHeading(date)}\n\n## 09:00\n\n${'w'.repeat(Math.floor(DAYS_MAX_CHARS * 0.6))}\n`;
		assert.ok(big('2026-11-02').length < MAX_DAY_BYTES);
		for (const date of ['2026-11-02', '2026-11-03']) writeDay(dir, date, big(date));
		const first = (await call('GET', 'days?from=2026-11-01&to=2026-11-08'))!.body as DaysAnswer;
		assert.deepEqual(first.days.map((d) => d.date), ['2026-11-01', '2026-11-02']);
		assert.equal(first.next, '2026-11-03');
		const rest = (await call('GET', `days?from=${first.next}&to=2026-11-08`))!.body as DaysAnswer;
		assert.deepEqual(rest.days.map((d) => d.date), datesBetween('2026-11-03', '2026-11-08'));
		assert.equal(rest.next, undefined);
		assert.equal(readDays(dir, '2026-11-02', '2026-11-03', { chars: 1, bytes: Infinity }, dayOf).days.length, 1);
		assert.equal(readDays(dir, '2026-11-02', '2026-11-03', { chars: Infinity, bytes: 1 }, dayOf).days.length, 1, 'a byte budget stops it too');
	});

	it('a day that breaks the rules, or is too big, is answered as it is, with its problems', async (t) => {
		const { call, dir, read } = engineOn(t);
		const broken = read().replace('## 13:15', '## 1:15');
		writeFileSync(dayFile(dir, DATE), broken);
		writeFileSync(dayFile(dir, '2026-10-02'), `${dateHeading('2026-10-02')}\n\n## 09:00\n\n${'x'.repeat(MAX_DAY_BYTES)}\n`);
		const { days } = (await call('GET', 'days?from=2026-10-01&to=2026-10-02'))!.body as DaysAnswer;
		assert.deepEqual(days[0]!.blocks, keyedBlocks(broken));
		assert.equal(days[0]!.problems.length, 1);
		assert.match(days[0]!.problems[0]!, /1:15/);
		assert.equal(days[1]!.exists, true);
		assert.equal(days[1]!.version, null);
		assert.deepEqual(days[1]!.blocks, []);
		assert.equal(days[1]!.problems.length, 1);
	});
});

describe('POST edit', () => {
	it('every saved edit answers its undo, and the undo puts the bytes back', async (t) => {
		const { edit, read } = engineOn(t);
		const original = read();
		const r = await edit(replaceAt(original, 2, 'Rewritten.'));
		assert.equal(r.status, 200);
		const { day, undo } = r.body as EditAnswer;
		assert.equal(day.version, version(read()));
		assert.deepEqual(day.blocks, keyedBlocks(read()));
		const back = await edit(undo);
		assert.equal(back.status, 200);
		assert.equal(read(), original);
	});

	it('an edit anchored to bytes that moved is refused with the day as it is now', async (t) => {
		const { edit, read, dir } = engineOn(t);
		const e = replaceAt(read(), 2, 'Mine.');
		const now = read().replace(e.before, `${e.before} The bot added this.`);
		writeFileSync(dayFile(dir, DATE), now);
		const r = await edit(e);
		assert.equal(r.status, 409);
		const p = r.body as RouteProblem;
		assert.equal(p.code, 'changed');
		assert.equal(p.status, 409);
		assert.equal(p.day!.version, version(now));
		assert.equal(read(), now);
	});

	it('an open block’s save lands after a write earlier in the same day: its text found once, it is moved', async (t) => {
		const { edit, read } = engineOn(t);
		const open = replaceAt(read(), 5, 'Saved where it now is.');
		assert.equal((await edit({ op: 'entry', date: DATE, time: '06:00', title: 'Early', text: 'The bot was first.' })).status, 200);
		const r = await edit(open);
		assert.equal(r.status, 200);
		assert.ok(read().includes('## 06:00 · Early\n\nThe bot was first.'));
		assert.ok(read().includes('Saved where it now is.'));
		assert.ok(!read().includes(open.before));
		assert.ok((r.body as EditAnswer).day.blocks.some((b) => b.text === 'Saved where it now is.'));
	});

	it('a before found twice, or not at all, is refused changed', async (t) => {
		const { edit, read, dir } = engineOn(t);
		const open = replaceAt(read(), 5, 'Mine.');
		const twice = read().replace('## 13:15', `## 07:00\n\n${open.before}\n\n## 13:15`);
		writeFileSync(dayFile(dir, DATE), twice);
		assert.equal(((await edit(open)).body as RouteProblem).code, 'changed');
		writeFileSync(dayFile(dir, DATE), twice.replaceAll(open.before, 'Gone.'));
		assert.equal(((await edit(open)).body as RouteProblem).code, 'changed');
	});

	it('refuses what is not an edit, a heading, an entry at a taken time, and any write to a day that breaks the rules', async (t) => {
		const { edit, read, dir } = engineOn(t);
		for (const bad of [null, 'x', {}, { op: 'replace', date: '../2026-10-01', start: 0, end: 1, before: '', after: '' }, { op: 'range', date: DATE, start: -3, end: 1, before: '', after: '' }]) {
			const r = await edit(bad);
			assert.equal(r.status, 400, JSON.stringify(bad));
			assert.equal((r.body as RouteProblem).code, 'unreadable');
		}
		const heading = await edit(replaceAt(read(), 2, '## 23:00'));
		assert.deepEqual([heading.status, (heading.body as RouteProblem).code], [422, 'heading']);
		const taken = await edit({ op: 'entry', date: DATE, time: '13:15', title: null, text: 'x' });
		assert.deepEqual([taken.status, (taken.body as RouteProblem).code], [422, 'entry-exists']);
		writeFileSync(dayFile(dir, DATE), `${read()}\n<i>by hand</i>\n`);
		const malformed = await edit({ op: 'entry', date: DATE, time: '23:00', title: null, text: 'x' });
		assert.deepEqual([malformed.status, (malformed.body as RouteProblem).code], [422, 'malformed']);
		assert.ok((malformed.body as RouteProblem).day!.problems.length > 0);
	});
});

describe('who and where', () => {
	it('a caller that is not the person is refused', async (t) => {
		const { call } = engineOn(t);
		const r = (await call('GET', 'days?from=2026-10-01&to=2026-10-01', undefined, { by: 'agent', agent: 'bot-1' }))!;
		assert.equal(r.status, 403);
		assert.equal((r.body as RouteProblem).code, 'caller');
	});

	it('a path the Journal does not serve is null, and a wrong method names the one it takes', async (t) => {
		const { call, engine } = engineOn(t);
		for (const p of ['', 'day', 'days/2026', '../days', 'edits', 'constructor', '__proto__']) assert.equal(await call('GET', p), null, p);
		const wrong = (await call('POST', 'days'))!;
		assert.equal(wrong.status, 405);
		assert.equal(wrong.headers?.Allow, 'GET');
		const signal = new AbortController().signal;
		const inPath = await engine.route({ method: 'GET', path: '/days?from=2026-10-01&to=2026-10-01', query: new URLSearchParams() }, { caller: PERSON, signal });
		assert.equal((inPath!.body as DaysAnswer).days.length, 1);
	});
});
