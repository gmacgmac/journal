// `reveal(ref)`: every ref shape the Journal has ever made is understood, from a change line or a sent chip, long after
// it was made; any other is said through `notify`, and nothing moves (spec § The view, § References).
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { addDays } from '../../src/format/index.ts';
import type { Ref } from '../../src/vendor/plugin-host/plugin-host.ts';
import { readReveal } from '../../src/view/reveal.ts';
import { say } from '../../src/view/words.ts';
import { PAGE_BATCH } from '../../src/view/feed.ts';
import { fire, installDom, settle, type FakeElement } from './fake-dom.ts';
import { fileOf, mounted, recent } from './fake-host.ts';

describe('reveal', () => {
	before(() => installDom());

	it('reads each shape the Journal makes, and nothing else', () => {
		assert.deepEqual(readReveal({ date: '2026-11-07' }), { date: '2026-11-07', key: null });
		assert.deepEqual(readReveal({ date: '2026-11-07', key: '9c1f02ab-0' }), { date: '2026-11-07', key: '9c1f02ab-0' });
		assert.deepEqual(readReveal({ from: '2026-11-02', to: '2026-11-08' }), { from: '2026-11-02', to: '2026-11-08' });
		for (const bad of [
			null, 'a', [], {}, { date: '2026-02-30' }, { date: '2026-11-07', key: 'nope' }, { date: 20261107 },
			{ from: '2026-11-08', to: '2026-11-02' }, { date: '2026-11-07', extra: true }, { from: '2026-11-02' },
			{ board: 'b1', head: 3 },
		]) assert.equal(readReveal(bad), null, JSON.stringify(bad));
	});

	it('a reveal of each ref shape the Journal has made is understood, and any other is said through notify', async () => {
		const { from } = recent();
		const older = Array.from({ length: PAGE_BATCH + 1 }, (_, i) => addDays(from, -1 - 2 * i));
		const oldest = older.at(-1)!;
		const m = await mounted((h) => { for (const d of older) h.files.set(d, fileOf(d, '## 08:00', 'Morning.')); });
		assert.equal(m.root.querySelector(`.day[data-date="${oldest}"]`), null, 'past the first batch');
		const key = m.dayOf(oldest).blocks[2]!.key;

		// { date, key }: the day brought onto the journal, in its place, and the block marked.
		m.view.reveal({ date: oldest, key });
		await settle();
		assert.ok(m.root.querySelector(`.block[data-date="${oldest}"][data-key="${key}"]`)!.classList.contains('fresh'));
		assert.equal([...m.root.querySelectorAll('.day')].at(-1)!.getAttribute('data-date'), oldest);

		// { date, key } whose block went: the day is marked instead.
		m.view.reveal({ date: oldest, key: '00000000-0' });
		await settle();
		assert.ok(m.root.querySelector(`.day[data-date="${oldest}"]`)!.classList.contains('fresh'));

		// { date }: a recent day, marked.
		m.view.reveal({ date: from });
		await settle();
		assert.ok(m.root.querySelector(`.day[data-date="${from}"]`)!.classList.contains('fresh'));

		// { from, to }: the newest page in it, marked.
		const range = { from: older[3]!, to: older[1]! };
		m.view.reveal(range);
		await settle();
		assert.ok(m.root.querySelector(`.day[data-date="${older[1]}"]`)!.classList.contains('fresh'));
		assert.deepEqual(m.view.pageChip()?.ref, recent(), 'the journal stays the journal');

		// In Day: the day named, alone.
		const q = (sel: string) => m.root.querySelector(sel) as unknown as FakeElement;
		fire(q('[data-view="day"]'), 'click');
		await settle();
		m.view.reveal({ date: older[2]! });
		await settle();
		assert.deepEqual(m.view.pageChip()?.ref, { from: older[2], to: older[2] });
		assert.deepEqual(m.calls.notes, []);

		// Anything else: said, and nothing moves.
		const gets = m.calls.gets.length;
		for (const bad of [{}, { date: 'tomorrow' }, { board: 'b1' }] as Ref[]) m.view.reveal(bad);
		await settle();
		assert.deepEqual(m.calls.notes, [0, 1, 2].map(() => [say('journal.view.reveal.unknown'), 'info']));
		assert.equal(m.calls.gets.length, gets);
		assert.deepEqual(m.view.pageChip()?.ref, { from: older[2], to: older[2] });
		m.view.unmount();
	});
});
