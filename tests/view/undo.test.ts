// Undo, one stack and one toast per mount.
import assert from 'node:assert/strict';
import { before, describe, it, mock } from 'node:test';
import { fire, installDom, newRoot, settle } from './fake-dom.ts';
import type { Day, EditResult, RangeEdit } from '../../src/view/app.ts';
import { el } from '../../src/view/render.ts';
import { createUndo, TOAST_MS, type UndoPage } from '../../src/view/undo.ts';

const DAY: Day = { date: '2026-10-01', title: 'D', exists: true, blocks: [] };
const undoEdit = (n: number): RangeEdit => ({ op: 'range', date: DAY.date, start: n, end: n + 1, before: 'x', after: '' });

/** A page that records what undo asked of it and answers each edit with `answer`. */
function fakePage(answer: (e: RangeEdit) => EditResult = (e) => ({ ok: true, day: DAY, undo: e })) {
	const calls = { edits: [] as RangeEdit[], patched: 0, focused: [] as [string, number][] };
	const page: UndoPage = {
		edit: async (e) => (calls.edits.push(e), answer(e)),
		patch: () => void (calls.patched += 1),
		focusAt: (date, start) => void calls.focused.push([date, start]),
	};
	return { page, calls };
}

function setup(answer?: (e: RangeEdit) => EditResult) {
	const root = newRoot();
	const toast = el('div', [el('span'), el('button', ['Undo'])], { hidden: '' });
	root.append(toast);
	const { page, calls } = fakePage(answer);
	const undo = createUndo(page, toast, root);
	const words = () => toast.querySelector('span')!.textContent;
	const offered = () => !toast.querySelector('button')!.hidden;
	return { root, toast, undo, calls, words, offered };
}

describe('undo', () => {
	before(() => installDom());

	it('a save shows its label with Undo, and Undo sends the newest undo first', async () => {
		const u = setup();
		u.undo.push(undoEdit(1), 'Saved.');
		u.undo.push(undoEdit(2), 'Deleted.');
		assert.equal(u.words(), 'Deleted.');
		assert.ok(u.offered() && !u.toast.hidden);
		await u.undo.undoLast();
		assert.deepEqual(u.calls.edits, [undoEdit(2)]);
		assert.equal(u.words(), 'Undone.');
		assert.ok(!u.offered());
		assert.deepEqual(u.calls.focused, [[DAY.date, 2]]);
		assert.equal(u.undo.depth, 1);
		u.undo.dispose();
	});

	it('says when there is nothing to undo, and when the page changed since', async () => {
		const u = setup(() => ({ ok: false, status: 409, reason: 'changed', day: DAY }));
		await u.undo.undoLast();
		assert.equal(u.words(), 'Nothing to undo.');
		u.undo.push(undoEdit(1));
		await u.undo.undoLast();
		assert.equal(u.words(), 'Can’t undo: that part has changed since.');
		assert.equal(u.calls.patched, 1);
		assert.deepEqual(u.calls.focused, []);
		u.undo.dispose();
	});

	it('⌘Z outside the writing undoes; inside the writing it is the browser’s', async () => {
		const u = setup();
		u.undo.push(undoEdit(1));
		const writing = el('div', [], { contenteditable: 'true' });
		u.root.append(writing);
		const inside = fire(writing, 'keydown', { key: 'z', metaKey: true });
		assert.ok(!inside.defaultPrevented);
		const outside = fire(u.root, 'keydown', { key: 'z', metaKey: true });
		assert.ok(outside.defaultPrevented);
		await settle();
		assert.deepEqual(u.calls.edits, [undoEdit(1)]);
		u.undo.dispose();
	});

	it('two mounts keep their own stacks and toasts', async () => {
		const a = setup();
		const b = setup();
		a.undo.push(undoEdit(1), 'Saved in A.');
		assert.equal(b.undo.depth, 0);
		assert.ok(b.toast.hidden);
		await b.undo.undoLast();
		assert.equal(b.words(), 'Nothing to undo.');
		assert.equal(a.words(), 'Saved in A.');
		assert.equal(a.undo.depth, 1);
		a.undo.dispose();
		b.undo.dispose();
	});

	it('the toast goes after its time; dispose stops the timer and unwires the keys', () => {
		mock.timers.enable({ apis: ['setTimeout'] });
		try {
			const u = setup();
			u.undo.notify('A line.');
			mock.timers.tick(TOAST_MS.plain);
			assert.ok(u.toast.hidden);
			u.undo.push(undoEdit(1));
			u.undo.dispose();
			mock.timers.tick(TOAST_MS.undo);
			assert.ok(!u.toast.hidden, 'a disposed toast keeps no timer');
			const e = fire(u.root, 'keydown', { key: 'z', metaKey: true });
			assert.ok(!e.defaultPrevented);
		} finally {
			mock.timers.reset();
		}
	});
});
