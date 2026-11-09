// The view tells the host when the pane header's Add to chat has something else to add (contract `pageChanged`, nclite
// item 160): once the first draw settles, then each time `pageChip()` would answer otherwise (another view, another day,
// days that grew past what `resolve` takes or came back under it, a new today), and never for a change the chip does not
// show, nor once unmounted. After each call `pageChip()` answers the new state (spec § The view, `pageChip()`).
import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';
import { addDays, CHIP_TEXT_CHARS, localToday } from '../../src/format/index.ts';
import { PAGE_BATCH } from '../../src/view/feed.ts';
import { recentDays } from '../../src/view/dates.ts';
import { fire, installDom, newRoot, settle, type FakeElement } from './fake-dom.ts';
import { fakeHost, fileOf, mounted, recent } from './fake-host.ts';
import { mountJournal } from '../../src/view/journal.ts';

const q = (root: HTMLElement, sel: string) => root.querySelector(sel) as unknown as FakeElement;
const one = (date: string) => ({ from: date, to: date });

describe('pageChanged', () => {
	before(() => installDom());

	it('pageChanged is said once the first draw settles, and pageChip then answers the days on show', async () => {
		const m = await mounted();
		assert.equal(m.calls.pageChanged, 1);
		assert.deepEqual(m.view.pageChip()?.ref, recent());
		m.view.unmount();
	});

	it('pageChip asked before the first draw settles is null and throws nothing (the host asks as the pane opens)', async () => {
		const h = fakeHost();
		const view = mountJournal(newRoot(), h.host);
		assert.equal(view.pageChip(), null);
		await settle();
		assert.deepEqual(view.pageChip()?.ref, recent());
		view.unmount();
	});

	it('pageChanged is said when the view, the day, a picked day or Add a page changes what is on show', async () => {
		const today = localToday();
		const m = await mounted();
		const said = (n: number, ref: unknown, what: string) => {
			assert.equal(m.calls.pageChanged, n, what);
			assert.deepEqual(m.view.pageChip()?.ref, ref, what);
		};
		fire(q(m.root, '[data-view="day"]'), 'click');
		await settle();
		said(2, one(today), 'Journal to Day');
		fire(q(m.root, '[data-nav="prev"]'), 'click');
		await settle();
		said(3, one(addDays(today, -1)), 'a day back');
		const pick = q(m.root, '.day-nav').querySelector('input.picker')!;
		pick.value = addDays(today, -9);
		fire(pick, 'change');
		await settle();
		said(4, one(addDays(today, -9)), 'a day picked');
		const add = q(m.root, '.add-anchor').querySelector('input.picker')!;
		add.value = addDays(today, -3);
		fire(add, 'change');
		await settle();
		said(5, one(addDays(today, -3)), 'Add a page jumps to its day');
		fire(q(m.root, '[data-nav="today"]'), 'click');
		await settle();
		said(6, one(today), 'back to today');
		fire(q(m.root, '[data-view="journal"]'), 'click');
		await settle();
		said(7, recent(), 'Day to Journal');
		m.view.unmount();
	});

	it('pageChanged is said when a day on show grows past CHIP_TEXT_CHARS and when it comes back under: null, then a chip', async () => {
		const { from } = recent();
		const m = await mounted();
		m.files.set(from, fileOf(from, '## 08:00', 'x'.repeat(CHIP_TEXT_CHARS)));
		m.emit({ date: from });
		await settle();
		assert.equal(m.calls.pageChanged, 2);
		assert.equal(m.view.pageChip(), null, 'nothing to add');
		m.files.delete(from);
		m.emit({ date: from });
		await settle();
		assert.equal(m.calls.pageChanged, 3);
		assert.deepEqual(m.view.pageChip()?.ref, recent());
		m.view.unmount();
	});

	it('pageChanged is not said for what the chip does not show: a batch of older pages, a page written, a scroll', async () => {
		const { from } = recent();
		const older = Array.from({ length: PAGE_BATCH + 3 }, (_, i) => addDays(from, -1 - i));
		const m = await mounted((h) => { for (const d of older) h.files.set(d, fileOf(d, '## 08:00', 'Then.')); });
		fire(q(m.root, '.feed-more'), 'click');
		await settle();
		assert.ok(m.root.querySelector(`.day[data-date="${older.at(-1)}"]`), 'the next batch landed');
		m.files.set(from, fileOf(from, '## 08:00', 'A page.'));
		m.emit({ date: from });
		await settle();
		fire(q(m.root, '.paper'), 'scroll');
		await settle();
		assert.equal(m.calls.pageChanged, 1);
		assert.deepEqual(m.view.pageChip()?.ref, recent());
		m.view.unmount();
	});

	it('pageChanged is said when the pane rolls over at midnight and the journal is drawn round the new today', async () => {
		const evening = new Date(2026, 10, 9, 23, 59);
		mock.timers.enable({ apis: ['Date'], now: evening });
		try {
			const m = await mounted();
			assert.deepEqual(m.view.pageChip()?.ref, recentDays('2026-11-09'));
			mock.timers.setTime(new Date(2026, 10, 10, 0, 1).getTime());
			m.files.set('2026-11-10', fileOf('2026-11-10', '## 00:01', 'Up late.'));
			m.emit({ date: '2026-11-10' });
			await settle();
			assert.equal(m.calls.pageChanged, 2);
			assert.deepEqual(m.view.pageChip()?.ref, recentDays('2026-11-10'));
			m.view.unmount();
		} finally {
			mock.timers.reset();
		}
	});

	it('pageChanged is never said once unmounted, not even by a first draw that settles after', async () => {
		const h = fakeHost();
		const view = mountJournal(newRoot(), h.host);
		view.unmount();
		await settle();
		assert.equal(h.calls.pageChanged, 0);
		const m = await mounted();
		m.view.unmount();
		m.files.set(recent().from, fileOf(recent().from, '## 08:00', 'x'.repeat(CHIP_TEXT_CHARS)));
		m.emit({ date: recent().from });
		await settle();
		assert.equal(m.calls.pageChanged, 1);
	});
});
