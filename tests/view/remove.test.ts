// Removing, as a person does it (GM, 2026-11-19): the view says "remove this entry" or "clear this day" and the engine does
// the bytes, so the edits sent name an entry by its id and a day by the version the person saw. A removed day stays on the
// sheet as one with no page, so Undo brings it back where it was.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { say } from '../../src/view/words.ts';
import { fire, installDom, settle, type FakeElement } from './fake-dom.ts';
import { fileOf, mounted, recent } from './fake-host.ts';

const q = (root: HTMLElement, sel: string) => root.querySelector(sel) as unknown as FakeElement;
const dayOf = (root: HTMLElement, date: string) => q(root, `.day[data-date="${date}"]`);
const keys = (root: HTMLElement, date: string) => [...(dayOf(root, date) as unknown as HTMLElement).querySelectorAll('.block')].map((b) => b.getAttribute('data-key'));

describe('removing', () => {
	before(() => installDom());

	it('Delete on an entry’s heading removes the entry by its id, writing and all', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.', '## 09:00', 'Later.')));
		const first = m.dayOf(from).blocks[1]!;
		fire(q(m.root, '.block.entry-head'), 'click');
		fire(q(m.root, '.block-bin'), 'click');
		await settle();
		assert.deepEqual(m.calls.edits, [{ op: 'remove', date: from, entry: first.key }]);
		assert.equal(m.files.get(from), fileOf(from, '## 09:00', 'Later.'));
		assert.equal((q(m.root, '.toast').querySelector('span') as unknown as FakeElement).textContent, say('journal.view.deleted'));
		assert.ok(!keys(m.root, from).includes(first.key), 'gone from the page');
		m.view.unmount();
	});

	it('emptying the only writing of an entry with a time and no title removes the entry, by its id', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, fileOf(from, '## 08:00', 'Morning.', '## 09:00', 'Later.')));
		const head = m.dayOf(from).blocks[1]!;
		fire(q(m.root, '.block[data-kind="paragraph"]'), 'click');
		fire(q(m.root, '.block-bin'), 'click');
		await settle();
		assert.deepEqual(m.calls.edits, [{ op: 'remove', date: from, entry: head.key }]);
		assert.equal(m.files.get(from), fileOf(from, '## 09:00', 'Later.'));
		m.view.unmount();
	});

	it('a hand-spaced file loses the entry as well: the engine finds the bytes, not the view', async () => {
		const { from } = recent();
		const m = await mounted((h) => h.files.set(from, `${fileOf(from, '## 08:00', 'Morning.').trimEnd()}\n\n\n\n## 09:00\n\nLater.\n`));
		fire(q(m.root, '.block.entry-head'), 'click');
		fire(q(m.root, '.block-bin'), 'click');
		await settle();
		assert.equal(m.calls.edits[0]!.op, 'remove');
		assert.equal(m.files.get(from), fileOf(from, '## 09:00', 'Later.'));
		m.view.unmount();
	});

	it('Remove this day clears it by the version seen, keeps it on the sheet with no page, and Undo brings it back', async () => {
		const { from } = recent();
		const m = await mounted((h) => {
			h.files.set(from, fileOf(from, '## 08:00', 'Morning.', '## 09:00', 'Later.'));
			h.knobs.confirm = async () => true;
		});
		const seen = m.dayOf(from);
		const was = keys(m.root, from);
		assert.ok(seen.version !== null);
		fire((dayOf(m.root, from).querySelector('.day-remove') as unknown as FakeElement), 'click');
		await settle();
		assert.deepEqual(m.calls.edits, [{ op: 'clear', date: from, version: seen.version }]);
		assert.equal(m.files.get(from), fileOf(from));
		const section = dayOf(m.root, from);
		assert.ok(section !== null && section.classList.contains('gap'), 'still on the sheet, as a day with no page');
		assert.equal(section.querySelector('.entries'), null);
		fire((q(m.root, '.toast').querySelector('button') as unknown as FakeElement), 'click');
		await settle();
		assert.equal(m.files.get(from), fileOf(from, '## 08:00', 'Morning.', '## 09:00', 'Later.'));
		const back = dayOf(m.root, from);
		assert.ok(!back.classList.contains('gap'), 'the day is back with its page');
		assert.deepEqual(keys(m.root, from), was);
		assert.equal(m.root.querySelectorAll(`.day[data-date="${from}"]`).length, 1);
		m.view.unmount();
	});

	it('a clear the engine refuses leaves the day as it was, with the reason said', async () => {
		const { from } = recent();
		const m = await mounted((h) => {
			h.files.set(from, fileOf(from, '## 08:00', 'Morning.'));
			h.knobs.confirm = async () => true;
		});
		// The file moves on after the day was read: the version the person saw is no longer the file's.
		m.files.set(from, fileOf(from, '## 08:00', 'Morning, changed.'));
		fire((dayOf(m.root, from).querySelector('.day-remove') as unknown as FakeElement), 'click');
		await settle();
		assert.equal(m.files.get(from), fileOf(from, '## 08:00', 'Morning, changed.'));
		assert.equal(m.calls.notes.length, 1);
		assert.ok(!dayOf(m.root, from).classList.contains('gap'));
		m.view.unmount();
	});
});
