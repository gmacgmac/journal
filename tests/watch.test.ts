// `watch` (docs/specification/plugin.md § Watching): it polls, says each day that appeared, changed or went, from anyone.
import assert from 'node:assert/strict';
import { appendFileSync, chmodSync, rmSync, writeFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createEngine } from '../src/engine/engine.ts';
import { createScanner, createWatch } from '../src/engine/watch.ts';
import { dateHeading } from '../src/format/index.ts';
import { dayFile, writeDay } from '../src/store/index.ts';
import type { Ref } from '../src/vendor/plugin-host/plugin-host.ts';
import { scratch } from './fixtures/days.ts';

/** The fixtures are September and October 2026: with this today, October is the previous month and September an old one. */
const today = () => '2026-11-07';
const POLL = 20;

const until = async (ok: () => boolean, ms = 2000): Promise<boolean> => {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (ok()) return true;
		await new Promise((r) => setTimeout(r, 5));
	}
	return ok();
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function watching(t: { after: (fn: () => void) => void }, opts: { pollMs?: number; sweepMs?: number; maxFiles?: number; maxEvents?: number } = {}) {
	const { dir, done } = scratch();
	const warned: string[] = [];
	const heard: Ref[] = [];
	const w = createWatch(dir, (m) => warned.push(m), { pollMs: opts.pollMs ?? POLL, sweepMs: opts.sweepMs ?? 60000, maxFiles: opts.maxFiles ?? 20000, maxEvents: opts.maxEvents ?? 50, today });
	const stop = w.watch((ref) => heard.push(ref));
	t.after(() => {
		stop();
		done();
	});
	const dates = () => heard.map((r) => r.date);
	return { dir, w, warned, heard, dates };
}

describe('watch', () => {
	it('a day written by another writer is said within two polls', async (t) => {
		const { dir, dates } = watching(t);
		await pause(POLL * 2);
		assert.deepEqual(dates(), [], 'the first pass only records');
		writeFileSync(dayFile(dir, '2026-09-27'), `${dateHeading('2026-09-27')}\n`);
		assert.ok(await until(() => dates().includes('2026-09-27'), POLL * 2 + 200), 'a new day in an old month');
		appendFileSync(dayFile(dir, '2026-10-01'), '\nMore, in place.\n');
		assert.ok(await until(() => dates().includes('2026-10-01'), POLL * 2 + 200), 'an in-place edit in the previous month');
		rmSync(dayFile(dir, '2026-10-02'));
		assert.ok(await until(() => dates().includes('2026-10-02'), POLL * 2 + 200), 'a day that went');
		assert.deepEqual(dates(), ['2026-09-27', '2026-10-01', '2026-10-02']);
	});

	it('an in-place edit of an old month is said by the next sweep', (t) => {
		const { dir, done } = scratch();
		t.after(done);
		const scanner = createScanner(dir, { maxFiles: 20000, today });
		assert.deepEqual(scanner.scan(false).changed, []);
		appendFileSync(dayFile(dir, '2026-09-28'), '\nIn place, by hand.\n');
		assert.deepEqual(scanner.scan(false).changed, [], 'the folder did not change, so a poll does not read it');
		assert.deepEqual(scanner.scan(true).changed, ['2026-09-28']);
		assert.deepEqual(scanner.scan(true).changed, []);
	});

	it('a burst of writes to one day between two polls is said once', async (t) => {
		const { dir, done } = scratch();
		t.after(done);
		const scanner = createScanner(dir, { maxFiles: 20000, today });
		scanner.scan(false);
		for (let i = 0; i < 5; i += 1) appendFileSync(dayFile(dir, '2026-10-05'), `\nLine ${i}.\n`);
		writeDay(dir, '2026-10-06', `${dateHeading('2026-10-06')}\n`);
		assert.deepEqual(scanner.scan(false).changed, ['2026-10-05', '2026-10-06']);
		const slow = 200;
		const live = watching(t, { pollMs: slow });
		await pause(slow / 2);
		for (let i = 0; i < 5; i += 1) appendFileSync(dayFile(live.dir, '2026-10-05'), `\nLine ${i}.\n`);
		await pause(slow * 3);
		assert.deepEqual(live.dates(), ['2026-10-05']);
	});

	it('the engine’s own write is said at once, and not again by the next poll', async (t) => {
		const { dir, done } = scratch();
		t.after(done);
		const engine = createEngine({ dir, name: () => 'A bot', warn: () => {}, flags: {} });
		const heard: Ref[] = [];
		const stop = engine.watch((ref) => heard.push(ref));
		t.after(stop);
		const r = await engine.route(
			{ method: 'POST', path: 'edit', query: new URLSearchParams(), body: { op: 'entry', date: '2026-10-03', time: '09:00', title: null, text: 'Hello.' } },
			{ caller: { by: 'person' }, signal: new AbortController().signal },
		);
		assert.equal(r!.status, 200);
		assert.deepEqual(heard, [{ date: '2026-10-03' }], 'said before the route answered');
		const fast = watching(t);
		await pause(POLL * 2);
		writeDay(fast.dir, '2026-10-04', `${dateHeading('2026-10-04')}\n`);
		fast.w.wrote('2026-10-04');
		assert.deepEqual(fast.dates(), ['2026-10-04']);
		await pause(POLL * 6);
		assert.deepEqual(fast.dates(), ['2026-10-04'], 'the polls do not say it again');
	});

	it('a folder it cannot read is warned once and never throws', { skip: process.getuid?.() === 0 }, async (t) => {
		const { dir, warned, dates } = watching(t);
		await pause(POLL * 2);
		chmodSync(dir, 0o000);
		try {
			await pause(POLL * 8);
			assert.equal(warned.length, 1);
		} finally {
			chmodSync(dir, 0o755);
		}
		writeFileSync(dayFile(dir, '2026-09-27'), `${dateHeading('2026-09-27')}\n`);
		assert.ok(await until(() => dates().includes('2026-09-27'), POLL * 2 + 200), 'it reads again once it can');
		assert.equal(warned.length, 1);
	});

	it('a listener that throws does not stop the others, and the last stop ends the polls', async (t) => {
		const { dir, done } = scratch();
		t.after(done);
		const w = createWatch(dir, () => {}, { pollMs: POLL, sweepMs: 60000, maxFiles: 20000, today });
		const heard: string[] = [];
		const a = w.watch(() => {
			throw new Error('a broken listener');
		});
		const b = w.watch((ref) => heard.push(String(ref.date)));
		w.wrote('2026-10-01');
		assert.deepEqual(heard, ['2026-10-01']);
		a();
		b();
		writeFileSync(dayFile(dir, '2026-09-27'), `${dateHeading('2026-09-27')}\n`);
		await pause(POLL * 4);
		assert.deepEqual(heard, ['2026-10-01']);
	});

	it('at most maxFiles day files are watched, and the cap is warned once', async (t) => {
		const { dir, warned, dates } = watching(t, { maxFiles: 3 });
		assert.equal(warned.length, 1);
		appendFileSync(dayFile(dir, '2026-10-01'), '\nNot watched.\n');
		appendFileSync(dayFile(dir, '2026-09-28'), '\nWatched.\n');
		writeFileSync(dayFile(dir, '2026-09-27'), `${dateHeading('2026-09-27')}\n`);
		assert.ok(await until(() => dates().includes('2026-09-28'), 1000));
		await pause(POLL * 3);
		assert.deepEqual(dates(), ['2026-09-28']);
		assert.equal(warned.length, 1);
	});

	it('a pass with more than maxEvents changes says one catch-up {} instead', async (t) => {
		const slow = 200;
		const { dir, heard } = watching(t, { pollMs: slow, maxEvents: 3 });
		await pause(slow / 2);
		for (const date of ['2026-10-01', '2026-10-02']) appendFileSync(dayFile(dir, date), '\nA few.\n');
		await pause(slow);
		assert.deepEqual(heard, [{ date: '2026-10-01' }, { date: '2026-10-02' }], 'a few changes are said one by one');
		heard.length = 0;
		for (const date of ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) appendFileSync(dayFile(dir, date), '\nMany.\n');
		await pause(slow * 2);
		assert.deepEqual(heard, [{}], 'many in one pass are one catch-up');
	});
});
