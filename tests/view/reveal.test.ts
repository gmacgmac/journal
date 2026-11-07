// `reveal(ref)`: every ref shape the Journal has ever made is understood, from a change line or a sent chip, long after
// it was made; any other is said through `notify`, and nothing moves (spec § The view, § References).
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { addDays } from '../../src/format/index.ts';
import type { Ref } from '../../src/vendor/plugin-host/plugin-host.ts';
import { weekOf } from '../../src/view/dates.ts';
import { readReveal } from '../../src/view/reveal.ts';
import { say } from '../../src/view/words.ts';
import { installDom, settle } from './fake-dom.ts';
import { fileOf, mounted, thisWeek } from './fake-host.ts';

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
		const later = addDays(thisWeek().from, 10);
		const m = await mounted((h) => h.files.set(later, fileOf(later, '## 08:00', 'Morning.')));
		const key = m.dayOf(later).blocks[2]!.key;

		// { date, key }: the week holding the date, the block marked.
		m.view.reveal({ date: later, key });
		await settle();
		assert.deepEqual(m.view.pageChip()?.ref, weekOf(later));
		assert.ok(m.root.querySelector(`.block[data-key="${key}"]`)!.classList.contains('fresh'));

		// { date, key } whose block went: the day is marked instead.
		m.view.reveal({ date: later, key: '00000000-0' });
		await settle();
		assert.ok(m.root.querySelector(`.day[data-date="${later}"]`)!.classList.contains('fresh'));

		// { date }: the week holding it.
		const back = thisWeek().from;
		m.view.reveal({ date: back });
		await settle();
		assert.deepEqual(m.view.pageChip()?.ref, thisWeek());

		// { from, to }: exactly that range.
		const range = { from: addDays(back, 2), to: addDays(back, 4) };
		m.view.reveal(range);
		await settle();
		assert.deepEqual(m.view.pageChip()?.ref, range);
		assert.deepEqual(m.calls.notes, []);

		// Anything else: said, and nothing moves.
		const gets = m.calls.gets.length;
		for (const bad of [{}, { date: 'tomorrow' }, { board: 'b1' }] as Ref[]) m.view.reveal(bad);
		await settle();
		assert.deepEqual(m.calls.notes, [0, 1, 2].map(() => [say('journal.view.reveal.unknown'), 'info']));
		assert.equal(m.calls.gets.length, gets);
		assert.deepEqual(m.view.pageChip()?.ref, range);
		m.view.unmount();
	});
});
