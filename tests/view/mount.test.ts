// The whole mount on a fake DOM and a fake host: it opens on the current week, reads a range in parts, follows the
// host's events, keeps two journals apart, and unmount leaves nothing behind and saves nothing.
// What needs a real browser (the caret, focus, layout, typing) is nclite's smoke walk (INT_01).
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { addDays, daysBetween } from '../../src/format/index.ts';
import { shift } from '../../src/view/dates.ts';
import { FakeEvent, fire, installDom, settle, type FakeElement } from './fake-dom.ts';
import { fileOf, mounted, thisWeek } from './fake-host.ts';

const q = (root: HTMLElement, sel: string) => root.querySelector(sel) as unknown as FakeElement;
const daysQuery = (from: string, to: string) => `days?from=${from}&to=${to}`;

describe('mount', () => {
	before(() => installDom());

	it('the range opens on the current week, Monday to Sunday', async () => {
		const m = await mounted();
		const week = thisWeek();
		assert.equal(new Date(`${week.from}T00:00:00Z`).getUTCDay(), 1, 'Monday');
		assert.equal(daysBetween(week.from, week.to), 7);
		assert.deepEqual(m.calls.gets, [daysQuery(week.from, week.to)]);
		assert.equal(m.root.querySelectorAll('.day').length, 7);
		assert.equal(q(m.root, '[data-range="from"]').value, week.from);
		assert.equal(q(m.root, '[data-range="to"]').value, week.to);
		assert.deepEqual(m.view.pageChip()?.ref, week);
		m.view.unmount();
	});

	it('a range is read in parts, following next', async () => {
		const m = await mounted((h) => (h.knobs.perAnswer = 3));
		const { from, to } = thisWeek();
		assert.deepEqual(m.calls.gets, [daysQuery(from, to), daysQuery(addDays(from, 3), to), daysQuery(addDays(from, 6), to)]);
		assert.deepEqual([...m.root.querySelectorAll('.day')].map((d) => d.getAttribute('data-date')), [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(from, n)));
		m.view.unmount();
	});

	it('a range that cannot be read is said through notify, and the page stays', async () => {
		const m = await mounted();
		const drawn = m.root.querySelector('.day');
		m.knobs.down = true;
		fire(q(m.root, '[data-range="next"]'), 'click');
		await settle();
		assert.equal(m.calls.notes.length, 1);
		assert.equal(m.calls.notes[0]![1], 'error');
		assert.equal(m.root.querySelector('.day'), drawn);
		assert.deepEqual(m.view.pageChip()?.ref, thisWeek());
		m.view.unmount();
	});

	it('an event of {} reads every day shown again, in place', async () => {
		const { from, to } = thisWeek();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.')));
		const kept = m.root.querySelector(`.day[data-date="${from}"]`);
		m.files.set(from, fileOf(from, '## 08:00', 'Morning.', 'Coffee.'));
		m.emit({});
		await settle();
		assert.deepEqual(m.calls.gets.slice(1), [daysQuery(from, to)]);
		assert.equal(m.root.querySelector(`.day[data-date="${from}"]`), kept, 'patched, not drawn anew');
		assert.equal(kept!.querySelectorAll('.block').length, 3);
		m.view.unmount();
	});

	it('an event of { date } reads that day again when it is shown, and is ignored otherwise', async () => {
		const { from } = thisWeek();
		const m = await mounted();
		m.emit({ date: from });
		m.emit({ date: addDays(from, 30) });
		m.emit({ board: 'b1' });
		await settle();
		assert.deepEqual(m.calls.gets.slice(1), [daysQuery(from, from)]);
		m.view.unmount();
	});

	it('two mounts in one page share nothing: range, hint, toast, events', async () => {
		const { from } = thisWeek();
		const file = fileOf(from, '## 08:00', '- [ ] water the plants');
		const a = await mounted((h) => h.files.set(from, file));
		const b = await mounted((h) => h.files.set(from, file));
		const hintA = q(a.root, '.edit-hint').id;
		const hintB = q(b.root, '.edit-hint').id;
		assert.notEqual(hintA, hintB);
		assert.ok([...a.root.querySelectorAll('.block')].every((n) => n.getAttribute('aria-describedby') === hintA));
		assert.ok([...b.root.querySelectorAll('.block')].every((n) => n.getAttribute('aria-describedby') === hintB));

		fire(q(a.root, '[data-range="next"]'), 'click');
		await settle();
		assert.deepEqual(a.view.pageChip()?.ref, shift(thisWeek(), 1));
		assert.deepEqual(b.view.pageChip()?.ref, thisWeek());

		const box = q(b.root, 'input.todo');
		box.checked = true;
		fire(box, 'click');
		await settle();
		assert.equal(b.calls.edits.length, 1);
		assert.equal(a.calls.edits.length, 0);
		assert.ok(!q(b.root, '.toast').hidden);
		assert.ok(q(a.root, '.toast').hidden);

		const gets = b.calls.gets.length;
		a.emit({ date: addDays(from, 7) });
		await settle();
		assert.equal(b.calls.gets.length, gets);
		a.view.unmount();
		b.view.unmount();
	});

	it('a refused tick is said through notify and the box goes back', async () => {
		const { from } = thisWeek();
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
		const { from } = thisWeek();
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
		const { from } = thisWeek();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.')));
		const taken = new FakeEvent('keydown', { key: 'Enter' });
		taken.preventDefault();
		q(m.root, '.block').dispatchEvent(taken);
		assert.equal(m.root.querySelector('.editing'), null);
		m.view.unmount();
	});

	it('unmount leaves nothing behind, stops listening and saves nothing', async () => {
		const { from } = thisWeek();
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
		const gets = m.calls.gets.length;
		m.emit({ date: from });
		await settle();
		assert.equal(m.calls.gets.length, gets);
	});
});
