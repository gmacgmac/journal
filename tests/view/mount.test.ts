// The whole mount on a fake DOM and a fake host: it opens on the running journal (today and the six days before, newest
// first, then older pages a batch at a time), steps a day at a time in Day, keeps its place per bot, follows the host's
// events, keeps two journals apart, and unmount leaves nothing behind and saves nothing.
// What needs a real browser (the caret, focus, layout, typing, the date picker) is nclite's smoke walk (INT_01).
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { addDays, localToday } from '../../src/format/index.ts';
import { PAGE_BATCH } from '../../src/view/feed.ts';
import { say } from '../../src/view/words.ts';
import { FakeEvent, fire, installDom, newRoot, settle, type FakeElement } from './fake-dom.ts';
import { fakeHost, fileOf, mounted, recent } from './fake-host.ts';
import { mountJournal } from '../../src/view/journal.ts';

const q = (root: HTMLElement, sel: string) => root.querySelector(sel) as unknown as FakeElement;
const dates = (root: HTMLElement) => [...root.querySelectorAll('.day')].map((d) => d.getAttribute('data-date'));
const daysQuery = (from: string, to: string) => `days?from=${from}&to=${to}`;
const pagesQuery = (before: string) => `pages?before=${before}&limit=${PAGE_BATCH}`;

describe('mount', () => {
	before(() => installDom());

	it('opens on the running journal: today and the six days before it, newest first', async () => {
		const m = await mounted();
		const { from, to } = recent();
		assert.equal(to, localToday());
		assert.deepEqual(m.calls.gets, [daysQuery(from, to), pagesQuery(from)]);
		assert.deepEqual(dates(m.root), [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(to, -n)));
		assert.deepEqual(m.view.pageChip()?.ref, { from, to });
		assert.ok(q(m.root, '.view-opt[data-view="journal"]').classList.contains('on'), 'the view shown is the filled one');
		assert.equal(q(m.root, '.views').getAttribute('aria-label'), say('journal.view.views.switch', { now: 'Journal', other: 'Day' }));
		assert.ok(q(m.root, '.day-nav').hidden, 'stepping a day is Day’s');
		m.view.unmount();
	});

	it('a recent day with no page is one line, and today says so', async () => {
		const { from, to } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.')));
		const empty = [...m.root.querySelectorAll('.day.gap')];
		assert.equal(empty.length, 6);
		for (const day of empty) {
			const head = day.querySelector('header')!;
			assert.ok(head.querySelector('.add-entry'), 'the way to start it sits on the date’s line');
			assert.equal(day.querySelector('.entries'), null);
		}
		const today = q(m.root, `.day[data-date="${to}"]`);
		assert.ok(today.classList.contains('today'));
		assert.ok(today.querySelector('.today-mark'));
		assert.equal(m.root.querySelectorAll('.today-mark').length, 1);
		m.view.unmount();
	});

	it('before the recent days, only days with a page, a gap marker between two apart, and Earlier pages while more are left', async () => {
		const { from } = recent();
		const older = Array.from({ length: PAGE_BATCH + 2 }, (_, i) => addDays(from, -1 - 3 * i));
		const m = await mounted((h) => { for (const d of older) h.files.set(d, fileOf(d, '## 08:00', 'Then.')); });
		assert.deepEqual(dates(m.root).slice(7), older.slice(0, PAGE_BATCH));
		const markers = [...m.root.querySelectorAll('.gap-marker')];
		assert.equal(markers.length, PAGE_BATCH - 1, 'one between every two older pages, none against the recent days');
		assert.deepEqual([markers[0]!.getAttribute('data-from'), markers[0]!.getAttribute('data-to')], [addDays(older[1]!, 1), addDays(older[0]!, -1)]);
		fire(q(m.root, '.feed-more'), 'click');
		await settle();
		assert.equal(m.calls.gets.at(-1), pagesQuery(older[PAGE_BATCH - 1]!));
		assert.deepEqual(dates(m.root).slice(7), older);
		assert.equal(m.root.querySelector('.feed-end'), null, 'no more to read');
		m.view.unmount();
	});

	it('the view toggle switches to the other view from anywhere on it, and to a view named on it', async () => {
		const m = await mounted();
		fire(q(m.root, '.views'), 'click');
		await settle();
		assert.ok(q(m.root, '.view-opt[data-view="day"]').classList.contains('on'));
		fire(q(m.root, '.view-opt[data-view="day"]'), 'click');
		await settle();
		assert.ok(q(m.root, '.view-opt[data-view="journal"]').classList.contains('on'), 'a press on the view shown switches too');
		fire(q(m.root, '.view-opt[data-view="day"]'), 'click');
		await settle();
		fire(q(m.root, '.view-opt[data-view="journal"]'), 'click');
		await settle();
		assert.ok(q(m.root, '.view-opt[data-view="journal"]').classList.contains('on'));
		m.view.unmount();
	});

	it('Day shows one day, steps a day at a time and comes back to today', async () => {
		const today = localToday();
		const m = await mounted();
		fire(q(m.root, '[data-view="day"]'), 'click');
		await settle();
		assert.deepEqual(dates(m.root), [today]);
		assert.ok(!q(m.root, '.day-nav').hidden);
		const toToday = q(m.root, '[data-nav="today"]');
		assert.ok(toToday.classList.contains('away'), 'on today already: kept in its place, out of sight');
		assert.equal(toToday.getAttribute('aria-hidden'), 'true');
		fire(q(m.root, '[data-nav="prev"]'), 'click');
		await settle();
		assert.deepEqual(dates(m.root), [addDays(today, -1)]);
		assert.deepEqual(m.view.pageChip()?.ref, { from: addDays(today, -1), to: addDays(today, -1) });
		assert.ok(!toToday.classList.contains('away'));
		assert.equal(toToday.getAttribute('aria-hidden'), null);
		fire(q(m.root, '[data-nav="today"]'), 'click');
		await settle();
		assert.deepEqual(dates(m.root), [today]);
		fire(q(m.root, '[data-view="journal"]'), 'click');
		await settle();
		assert.equal(dates(m.root).length, 7);
		m.view.unmount();
	});

	it('in Day, a day with no page is a blank page: a press anywhere on it starts writing', async () => {
		const m = await mounted();
		fire(q(m.root, '[data-view="day"]'), 'click');
		await settle();
		fire(q(m.root, '.sheet'), 'click');
		assert.ok(q(m.root, '.day.gap').querySelector('.entry-draft'));
		m.view.unmount();
	});

	it('the place is kept per bot: the next mount opens where the last one was, and on today once the date moves on', async () => {
		const store = new Map<string, string>();
		const a = await mounted((h) => h.useStore(store));
		fire(q(a.root, '[data-view="day"]'), 'click');
		await settle();
		fire(q(a.root, '[data-nav="prev"]'), 'click');
		await settle();
		a.view.unmount();
		const b = await mounted((h) => h.useStore(store));
		assert.deepEqual(dates(b.root), [addDays(localToday(), -1)]);
		b.view.unmount();
		store.set('place', JSON.stringify({ view: 'day', date: '2020-01-01', on: '2020-01-01' }));
		const c = await mounted((h) => h.useStore(store));
		assert.deepEqual(dates(c.root), [localToday()], 'kept on another day: the view stays, the day is today');
		c.view.unmount();
	});

	it('a view that cannot be read is said through notify, and the sheet stays', async () => {
		const m = await mounted();
		const drawn = m.root.querySelector('.day');
		m.knobs.down = true;
		fire(q(m.root, '[data-view="day"]'), 'click');
		await settle();
		assert.equal(m.calls.notes.length, 1);
		assert.equal(m.calls.notes[0]![1], 'error');
		assert.equal(m.root.querySelector('.day'), drawn);
		assert.deepEqual(m.view.pageChip()?.ref, recent());
		m.view.unmount();
	});

	it('Add a page asks which day and opens a new entry on it, in its place', async () => {
		const { from } = recent();
		const far = addDays(from, -20);
		const m = await mounted((h) => h.files.set(addDays(from, -40), fileOf(addDays(from, -40), '## 08:00', 'Long ago.')));
		fire(q(m.root, '[data-add]'), 'click');
		const field = q(m.root, '.add-anchor').querySelector('input.picker')!;
		assert.ok(field.classList.contains('shown'), 'no picker in the fake: the field is shown instead');
		assert.equal(field.value, localToday());
		field.value = far;
		fire(field, 'change');
		await settle();
		assert.deepEqual(dates(m.root).slice(7), [far, addDays(from, -40)], 'in date order');
		const day = q(m.root, `.day[data-date="${far}"]`);
		assert.ok(day.classList.contains('placed'));
		assert.ok(day.querySelector('.entry-draft'), 'a new entry, open for writing');
		assert.equal(m.root.querySelectorAll('.gap-marker').length, 2);
		m.view.unmount();
	});

	it('a gap marker that did not change is kept through a relayout, so focus on it stays (review 2026-11-09)', async () => {
		const { from } = recent();
		const far = addDays(from, -9);
		const m = await mounted((h) => h.files.set(far, fileOf(far, '## 08:00', 'Then.')));
		const marker = q(m.root, '.gap-marker');
		m.files.set(far, fileOf(far, '## 08:00', 'Then, and more.'));
		m.emit({ date: far });
		await settle();
		assert.equal(q(m.root, '.gap-marker'), marker, 'the same element');
		m.view.unmount();
	});

	it('a gap of one day adds a page there at once; a longer gap holds the picker to its days', async () => {
		const { from } = recent();
		const m = await mounted((h) => {
			for (const d of [addDays(from, -2), addDays(from, -4), addDays(from, -9)]) h.files.set(d, fileOf(d, '## 08:00', 'Then.'));
		});
		const marker = (first: string) => q(m.root, `.gap-marker[data-from="${first}"]`);
		fire(marker(addDays(from, -3)).querySelector('.gap-add'), 'click');
		await settle();
		assert.ok(q(m.root, `.day[data-date="${addDays(from, -3)}"]`).querySelector('.entry-draft'));
		const four = marker(addDays(from, -8));
		fire(four.querySelector('.gap-add'), 'click');
		const field = four.querySelector('input.picker')!;
		assert.deepEqual([field.getAttribute('min'), field.getAttribute('max'), field.value], [addDays(from, -8), addDays(from, -5), addDays(from, -5)]);
		field.value = addDays(from, -30);
		fire(field, 'change');
		await settle();
		assert.equal(m.root.querySelector(`.day[data-date="${addDays(from, -30)}"]`), null, 'a day outside the gap is not taken');
		m.view.unmount();
	});

	it('an event of {} that comes before the first draw settles (the host says one as its stream opens) throws nothing and reads nothing twice', async () => {
		const h = fakeHost();
		const root = newRoot();
		const view = mountJournal(root, h.host);
		h.emit({});
		await settle();
		assert.deepEqual(h.calls.notes, []);
		assert.equal(dates(root).length, 7);
		view.unmount();
	});

	it('an event of {} reads every day shown again, in place', async () => {
		const { from, to } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.')));
		const kept = m.root.querySelector(`.day[data-date="${from}"]`);
		m.files.set(from, fileOf(from, '## 08:00', 'Morning.', 'Coffee.'));
		m.emit({});
		await settle();
		assert.deepEqual(m.calls.gets.slice(2), [daysQuery(from, to)]);
		assert.equal(m.root.querySelector(`.day[data-date="${from}"]`), kept, 'patched, not drawn anew');
		assert.equal(kept!.querySelectorAll('.block').length, 3);
		m.view.unmount();
	});

	it('an event of { date } reads a day shown again, draws a new older page in, and ignores the rest', async () => {
		const { from } = recent();
		const m = await mounted();
		m.emit({ date: from });
		m.emit({ date: addDays(localToday(), 30) });
		m.emit({ board: 'b1' });
		await settle();
		assert.deepEqual(m.calls.gets.slice(2), [daysQuery(from, from)]);
		const older = addDays(from, -5);
		m.files.set(older, fileOf(older, '## 08:00', 'The bot wrote this.'));
		m.emit({ date: older });
		await settle();
		assert.ok(q(m.root, `.day[data-date="${older}"]`).classList.contains('fresh'));
		m.view.unmount();
	});

	it('two mounts in one page share nothing: view, hint, toast, events', async () => {
		const { from } = recent();
		const file = fileOf(from, '## 08:00', '- [ ] water the plants');
		const a = await mounted((h) => h.files.set(from, file));
		const b = await mounted((h) => h.files.set(from, file));
		const hintA = q(a.root, '.edit-hint').id;
		const hintB = q(b.root, '.edit-hint').id;
		assert.notEqual(hintA, hintB);
		assert.ok([...a.root.querySelectorAll('.block')].every((n) => n.getAttribute('aria-describedby') === hintA));
		assert.ok([...b.root.querySelectorAll('.block')].every((n) => n.getAttribute('aria-describedby') === hintB));

		fire(q(a.root, '[data-view="day"]'), 'click');
		await settle();
		assert.deepEqual(a.view.pageChip()?.ref, { from: localToday(), to: localToday() });
		assert.deepEqual(b.view.pageChip()?.ref, recent());

		const box = q(b.root, 'input.todo');
		box.checked = true;
		fire(box, 'click');
		await settle();
		assert.equal(b.calls.edits.length, 1);
		assert.equal(a.calls.edits.length, 0);
		assert.ok(!q(b.root, '.toast').hidden);
		assert.ok(q(a.root, '.toast').hidden);

		const gets = b.calls.gets.length;
		a.emit({ date: localToday() });
		await settle();
		assert.equal(b.calls.gets.length, gets);
		a.view.unmount();
		b.view.unmount();
	});

	it('an entry with no title takes one from its writing: Add title saves it and opens the title in place', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.')));
		const titleButton = q(m.root, '[data-act="title"]');
		fire(q(m.root, '.block[data-kind="paragraph"]'), 'click');
		assert.ok(!titleButton.hidden, 'offered from the writing of an entry with no title');
		fire(titleButton, 'click');
		await settle();
		const head = q(m.root, '.block.entry-head');
		assert.ok(head.classList.contains('has-title'));
		assert.ok(head.classList.contains('editing'), 'the heading is open, its title ready');
		assert.ok(head.querySelector('.title'));
		assert.deepEqual(m.calls.edits, [], 'nothing changed, so nothing was saved yet');
		m.view.unmount();
	});

	it('an entry that has a title does not offer another from its writing', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00 · Walk', 'Morning.')));
		fire(q(m.root, '.block[data-kind="paragraph"]'), 'click');
		assert.ok(q(m.root, '[data-act="title"]').hidden);
		m.view.unmount();
	});

	it('an entry with no time keeps the margin empty and its title where every title sits', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## Morning walk', 'Cold.', '## 10:40 · Sheep', 'Many.')));
		const [untimed, timed] = [...q(m.root, `.day[data-date="${from}"]`).querySelectorAll('.entry-head')];
		assert.ok(untimed!.classList.contains('no-time') && untimed!.classList.contains('has-title'));
		assert.ok(untimed!.querySelector('.time')!.hidden);
		assert.equal(untimed!.querySelector('.title')!.textContent, 'Morning walk');
		assert.ok(!timed!.classList.contains('no-time'));
		m.view.unmount();
	});

	it('a new entry can be written with no time: No time takes it off and opens the title, Add time puts it back', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.')));
		const bar = (act: string) => q(m.root, `[data-act="${act}"]`);
		fire(q(m.root, `.day[data-date="${from}"]`).querySelector('.add-entry'), 'click');
		const draft = q(m.root, '.entry-draft');
		const time = draft.querySelector('.time')!;
		assert.ok(!bar('notime').hidden && bar('addtime').hidden, 'a new entry has a time, and can drop it');
		const now = time.textContent;
		fire(bar('notime'), 'click');
		assert.ok(time.hidden && draft.classList.contains('no-time'));
		assert.ok(draft.querySelector('.title'), 'the title opens: it now holds the entry');
		assert.ok(bar('notime').hidden && !bar('addtime').hidden);
		fire(bar('addtime'), 'click');
		assert.ok(!time.hidden && time.textContent === now, 'the time it had comes back');
		fire(bar('notime'), 'click');
		draft.querySelector('.title')!.replaceChildren('Thoughts');
		draft.querySelector('.entry-body')!.querySelector('p')!.replaceChildren('No time for this.');
		fire(bar('done'), 'click');
		await settle();
		assert.deepEqual(m.calls.edits.at(-1), { op: 'entry', date: from, time: null, title: 'Thoughts', text: 'No time for this.' });
		m.view.unmount();
	});

	it('a refused tick is said through notify and the box goes back', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', '- [ ] water the plants')));
		m.knobs.edit = () => new Response(JSON.stringify({ title: 'Refused for the test.', status: 422, code: 'rules' }), { status: 422 });
		const box = q(m.root, 'input.todo');
		box.checked = true;
		fire(box, 'click');
		await settle();
		assert.deepEqual(m.calls.notes, [['Refused for the test.', 'error']]);
		assert.equal(box.checked, false);
		m.view.unmount();
	});

	it('a page that breaks the rules opens nothing for writing', async () => {
		const { from } = recent();
		const m = await mounted((h) => {
			h.files.set(from, fileOf(from, '## 08:00', 'Morning.'));
			h.problems.set(from, ['A problem.']);
		});
		const block = q(m.root, `.day[data-date="${from}"]`).querySelector('.block')!;
		fire(block, 'click');
		const enter = new FakeEvent('keydown', { key: 'Enter' });
		block.dispatchEvent(enter);
		assert.equal(m.root.querySelector('.editing'), null);
		assert.ok(!enter.defaultPrevented);
		m.view.unmount();
	});

	it('an Enter another handler already took opens nothing', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.')));
		const taken = new FakeEvent('keydown', { key: 'Enter' });
		taken.preventDefault();
		q(m.root, '.block').dispatchEvent(taken);
		assert.equal(m.root.querySelector('.editing'), null);
		m.view.unmount();
	});

	it('unmount leaves nothing behind, stops listening and saves nothing', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.')));
		const block = q(m.root, '.block[data-kind="paragraph"]');
		fire(block, 'click');
		block.querySelector('p')!.replaceChildren('Morning, changed.');
		assert.equal(m.view.unsaved(), true);
		m.view.unmount();
		await settle();
		assert.deepEqual(m.calls.edits, []);
		assert.deepEqual(m.calls.asks, []);
		assert.equal(m.root.childNodes.length, 0);
		assert.ok(!m.root.classList.contains('journal'));
		assert.equal(m.listeners.size, 0);
		assert.equal((m.root as unknown as FakeElement).listenerCount(), 0);
		assert.equal((document as unknown as FakeElement).listenerCount(), 0, 'nor on the document');
		const gets = m.calls.gets.length;
		m.emit({ date: from });
		await settle();
		assert.equal(m.calls.gets.length, gets);
	});
});
