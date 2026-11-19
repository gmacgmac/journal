// Drag to reorder, driven as a person drives it (GM, 2026-11-19): through the mount, with the keys on a handle and with
// pointer events on it. What reaches the engine is one `move` edit that names the entry and the one it goes in front of;
// what is left on the page when it is put back, or when the journal is closed mid-lift, is nothing.
// The fake DOM has no layout, so the tests that need places stack every block 40px below the last.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { say } from '../../src/view/words.ts';
import { FakeElement, fire, installDom, settle } from './fake-dom.ts';
import { fileOf, mounted, recent } from './fake-host.ts';

const g = globalThis as Record<string, unknown>;
const q = (root: HTMLElement, sel: string) => root.querySelector(sel) as unknown as FakeElement;
const all = (root: HTMLElement, sel: string) => [...root.querySelectorAll(sel)] as unknown as FakeElement[];
const voice = (root: HTMLElement) => q(root, '.journal-voice').textContent;

const BLOCK_PX = 40;
const stacked = FakeElement.prototype.getBoundingClientRect;
const saved = { DOMRect: g.DOMRect, raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame, listen: g.addEventListener };
/** The blur listeners the page took (`window` is the global here), each gone when its signal aborts. */
const blurs = new Set<() => void>();

const WEEK = ['## Weekend', 'Leaving early.', '## 16:40', 'Tea.', '## Notes', 'A note.'];

/** A journal whose one page, on a day that is not today, holds the entries of WEEK. */
async function week() {
	const { from } = recent();
	const m = await mounted((h) => h.files.set(from, fileOf(from, ...WEEK)));
	const ids = m.dayOf(from).blocks.slice(1).filter((b) => b.text.startsWith('## ')).map((b) => b.key);
	const handles = () => all(m.root, '.drag-handle');
	return { ...m, from, ids, handles };
}

/** The pointer as a browser sends it to a handle that holds the press. */
const send = (target: unknown, type: string, y: number, init: Record<string, unknown> = {}) =>
	fire(target, type, { pointerId: 1, button: 0, buttons: 1, clientX: 0, clientY: y, ...init });

describe('drag to reorder', () => {
	before(() => {
		installDom();
		g.DOMRect = class {
			left: number;
			top: number;
			width: number;
			height: number;
			constructor(left = 0, top = 0, width = 0, height = 0) {
				[this.left, this.top, this.width, this.height] = [left, top, width, height];
			}
			get right() { return this.left + this.width; }
			get bottom() { return this.top + this.height; }
		};
		g.requestAnimationFrame = () => 1;
		g.cancelAnimationFrame = () => {};
		g.addEventListener = (type: string, fn: () => void, opts?: { signal?: AbortSignal }) => {
			if (type !== 'blur') return;
			blurs.add(fn);
			opts?.signal?.addEventListener('abort', () => blurs.delete(fn));
		};
		FakeElement.prototype.getBoundingClientRect = function (this: FakeElement) {
			if (!this.classList.contains('block')) return stacked.call(this);
			const top = [...(document as unknown as { documentElement: FakeElement }).documentElement.querySelectorAll('.block')].indexOf(this) * BLOCK_PX;
			return { top, left: 0, right: 300, bottom: top + BLOCK_PX, width: 300, height: BLOCK_PX };
		};
	});
	after(() => {
		FakeElement.prototype.getBoundingClientRect = stacked;
		Object.assign(g, { DOMRect: saved.DOMRect, requestAnimationFrame: saved.raf, cancelAnimationFrame: saved.caf, addEventListener: saved.listen });
	});

	it('an entry with a time has no handle; one without has a button that names it', async () => {
		const m = await week();
		assert.equal(m.handles().length, 2, 'Weekend and Notes, not 16:40');
		assert.deepEqual(m.handles().map((h) => h.getAttribute('aria-label')), [say('journal.view.move.handle', { entry: 'Weekend' }), say('journal.view.move.handle', { entry: 'Notes' })]);
		assert.equal(q(m.root, '.block.entry-head:not(.no-time)').querySelector('.drag-handle'), null);
		m.view.unmount();
	});

	describe('from the keys', () => {
		it('Space lifts and says so, Down moves and says where, Enter drops: one move edit that names the entry and what it goes before', async () => {
			const m = await week();
			const weekend = m.handles()[0]!;
			weekend.focus();
			const lift = fire(weekend, 'keydown', { key: ' ' });
			assert.ok(lift.defaultPrevented);
			assert.equal(voice(m.root), say('journal.view.move.lifted', { entry: 'Weekend', n: 1, count: 3 }));
			assert.ok(m.root.classList.contains('dragging'));
			fire(weekend, 'keydown', { key: 'ArrowDown' });
			assert.equal(voice(m.root), say('journal.view.move.over', { n: 2, count: 3 }));
			assert.deepEqual(m.calls.edits, [], 'nothing is saved until it is dropped');
			fire(weekend, 'keydown', { key: 'Enter' });
			await settle();
			assert.deepEqual(m.calls.edits, [{ op: 'move', date: m.from, entry: m.ids[0], before: m.ids[2] }]);
			assert.equal(m.files.get(m.from), fileOf(m.from, '## 16:40', 'Tea.', '## Weekend', 'Leaving early.', '## Notes', 'A note.'));
			assert.equal(voice(m.root), say('journal.view.move.dropped', { entry: 'Weekend', n: 2, count: 3 }));
			assert.equal((q(m.root, '.toast').querySelector('span') as unknown as FakeElement).textContent, say('journal.view.move.moved'));
			assert.ok(!m.root.classList.contains('dragging'));
			assert.equal(m.root.querySelector('.drop-line'), null);
			assert.equal(all(m.root, '.drag-source').length, 0);
			m.view.unmount();
		});

		it('Down past the last place drops at the end of the day: before is null', async () => {
			const m = await week();
			const weekend = m.handles()[0]!;
			fire(weekend, 'keydown', { key: ' ' });
			for (let i = 0; i < 5; i += 1) fire(weekend, 'keydown', { key: 'ArrowDown' });
			fire(weekend, 'keydown', { key: ' ' });
			await settle();
			assert.deepEqual(m.calls.edits, [{ op: 'move', date: m.from, entry: m.ids[0], before: null }]);
			assert.equal(m.files.get(m.from), fileOf(m.from, '## 16:40', 'Tea.', '## Notes', 'A note.', '## Weekend', 'Leaving early.'));
			m.view.unmount();
		});

		it('Enter at once, where it already is, drops nothing and sends nothing', async () => {
			const m = await week();
			const weekend = m.handles()[0]!;
			fire(weekend, 'keydown', { key: 'Enter' });
			fire(weekend, 'keydown', { key: 'Enter' });
			await settle();
			assert.deepEqual(m.calls.edits, []);
			assert.equal(all(m.root, '.drag-source').length, 0);
			m.view.unmount();
		});

		it('Escape puts it back, says so and sends nothing', async () => {
			const m = await week();
			const weekend = m.handles()[0]!;
			fire(weekend, 'keydown', { key: ' ' });
			fire(weekend, 'keydown', { key: 'ArrowDown' });
			fire(weekend, 'keydown', { key: 'Escape' });
			await settle();
			assert.equal(voice(m.root), say('journal.view.move.cancelled'));
			assert.deepEqual(m.calls.edits, []);
			assert.equal(m.files.get(m.from), fileOf(m.from, ...WEEK));
			assert.ok(!m.root.classList.contains('dragging'));
			assert.equal(m.root.querySelector('.drop-line'), null);
			assert.equal(all(m.root, '.drag-source').length, 0);
			m.view.unmount();
		});

		it('focus leaving the handle puts it back', async () => {
			const m = await week();
			const weekend = m.handles()[0]!;
			fire(weekend, 'keydown', { key: ' ' });
			fire(weekend, 'keydown', { key: 'ArrowDown' });
			fire(weekend, 'focusout');
			await settle();
			assert.equal(voice(m.root), say('journal.view.move.cancelled'));
			assert.deepEqual(m.calls.edits, []);
			assert.ok(!m.root.classList.contains('dragging'));
			m.view.unmount();
		});
	});

	describe('with the pointer', () => {
		/** Presses the first handle and moves 10px: lifted. */
		async function lifted() {
			const m = await week();
			const handle = m.handles()[0]!;
			const down = send(handle, 'pointerdown', 20);
			send(handle, 'pointermove', 30);
			return { ...m, handle, down };
		}

		it('a press holds the pointer, and a move under 4px is still a click; past it, the entry lifts', async () => {
			const m = await week();
			const handle = m.handles()[0]!;
			const down = send(handle, 'pointerdown', 20);
			assert.ok(down.defaultPrevented);
			assert.equal(handle.captured, 1);
			send(handle, 'pointermove', 22);
			assert.equal(m.root.querySelector('.drag-ghost'), null);
			send(handle, 'pointermove', 30);
			assert.ok(q(m.root, '.drag-ghost'), 'a copy follows the pointer');
			assert.ok(m.root.classList.contains('dragging'));
			assert.equal(all(m.root, '.drag-source').length, 2, 'the entry’s own two blocks go faint');
			m.view.unmount();
		});

		it('another button, or a press that is not on a handle, lifts nothing', async () => {
			const m = await week();
			send(m.handles()[0], 'pointerdown', 20, { button: 2 });
			send(m.handles()[0], 'pointermove', 90);
			send(q(m.root, '.block[data-kind="paragraph"]'), 'pointerdown', 20);
			send(q(m.root, '.block[data-kind="paragraph"]'), 'pointermove', 90);
			assert.equal(m.root.querySelector('.drag-ghost'), null);
			m.view.unmount();
		});

		it('letting go lower down drops it there: one move edit, before the entry that is nearest', async () => {
			const m = await lifted();
			send(m.handle, 'pointermove', 140);
			assert.ok(!q(m.root, '.drop-line').hidden, 'a line shows where it will land');
			send(m.handle, 'pointerup', 140);
			await settle();
			assert.deepEqual(m.calls.edits, [{ op: 'move', date: m.from, entry: m.ids[0], before: m.ids[2] }]);
			assert.equal(m.root.querySelector('.drag-ghost'), null);
			assert.equal(all(m.root, '.drag-source').length, 0);
			assert.equal(m.root.querySelector('.drop-line'), null);
			m.view.unmount();
		});

		it('dropped past the last entry it goes to the end of the day', async () => {
			const m = await lifted();
			send(m.handle, 'pointermove', 400);
			send(m.handle, 'pointerup', 400);
			await settle();
			assert.deepEqual(m.calls.edits, [{ op: 'move', date: m.from, entry: m.ids[0], before: null }]);
			m.view.unmount();
		});

		it('let go where it began sends nothing', async () => {
			const m = await lifted();
			send(m.handle, 'pointermove', 20);
			send(m.handle, 'pointerup', 20);
			await settle();
			assert.deepEqual(m.calls.edits, []);
			assert.equal(m.root.querySelector('.drag-ghost'), null);
			m.view.unmount();
		});

		it('Escape puts it back, and a later move does not lift it again', async () => {
			const m = await lifted();
			fire(m.handle, 'keydown', { key: 'Escape' });
			assert.equal(m.root.querySelector('.drag-ghost'), null);
			assert.equal(m.root.querySelector('.drop-line'), null);
			assert.equal(all(m.root, '.drag-source').length, 0);
			send(m.handle, 'pointermove', 90);
			send(m.handle, 'pointerup', 90);
			await settle();
			assert.equal(m.root.querySelector('.drag-ghost'), null);
			assert.deepEqual(m.calls.edits, []);
			m.view.unmount();
		});

		it('a move that says no button is down (it came up in another window) puts it back', async () => {
			const m = await lifted();
			send(m.handle, 'pointermove', 90, { buttons: 0 });
			assert.equal(m.root.querySelector('.drag-ghost'), null);
			assert.ok(!m.root.classList.contains('dragging'));
			send(m.handle, 'pointerup', 90);
			await settle();
			assert.deepEqual(m.calls.edits, []);
			m.view.unmount();
		});

		it('the pointer being taken away (cancelled, or capture lost) puts it back', async () => {
			for (const type of ['pointercancel', 'lostpointercapture']) {
				const m = await lifted();
				send(m.handle, type, 90);
				assert.equal(m.root.querySelector('.drag-ghost'), null, type);
				assert.equal(all(m.root, '.drag-source').length, 0, type);
				await settle();
				assert.deepEqual(m.calls.edits, [], type);
				m.view.unmount();
			}
		});

		it('the window losing focus puts it back', async () => {
			const m = await lifted();
			assert.equal(blurs.size, 1);
			for (const fn of [...blurs]) fn();
			assert.equal(m.root.querySelector('.drag-ghost'), null);
			assert.ok(!m.root.classList.contains('dragging'));
			m.view.unmount();
		});

		it('unmount mid-lift leaves no copy, no line and no listener, and saves nothing', async () => {
			const m = await lifted();
			assert.ok(q(m.root, '.drag-ghost') && q(m.root, '.drop-line'));
			m.view.unmount();
			await settle();
			assert.equal(m.root.childNodes.length, 0);
			assert.equal(m.root.querySelector('.drag-ghost'), null);
			assert.equal(m.root.querySelector('.drop-line'), null);
			assert.equal(blurs.size, 0, 'the window’s blur is no longer heard');
			assert.equal((m.root as unknown as FakeElement).listenerCount(), 0);
			assert.deepEqual(m.calls.edits, []);
			send(m.handle, 'pointerup', 140);
			await settle();
			assert.deepEqual(m.calls.edits, [], 'a late release finds nobody listening');
		});
	});
});
