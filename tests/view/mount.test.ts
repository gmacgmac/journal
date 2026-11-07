// The whole mount on a fake DOM: two journals in one page share nothing, and unmount leaves nothing behind.
// What needs a real browser (the caret, focus, layout, typing) is INT_01's smoke walk.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { fire, installDom, newRoot, settle, type FakeElement } from './fake-dom.ts';
import type { Chip, Day, DayBlock, DayEvent, Edit, JournalApp } from '../../src/view/app.ts';
import { addDays, shift, spanOf } from '../../src/view/dates.ts';
// `view.ts` passes straight through to `mountJournal` and imports the stylesheet, which Node cannot load; the build
// test holds `view.ts` itself (one module, exporting only `mount`).
import { mountJournal as mount, SAMPLE_WEEK } from '../../src/view/journal.ts';

/** A day with one entry holding one to-do; its key changes with the box so a save is a real change. */
function dayOf(date: string, done = false): Day {
	const texts = [`# ${date}`, '## 08:00', `- [${done ? 'x' : ' '}] water the plants`];
	let at = 0;
	const blocks: DayBlock[] = texts.map((text) => {
		const b = { start: at, end: at + text.length, text, key: `${date}:${text}` };
		at = b.end + 2;
		return b;
	});
	return { date, title: date, exists: true, blocks };
}

/** A host as the view's adapter sees it, recording every call. */
function fakeApp() {
	const calls = { gets: [] as string[], edits: [] as Edit[], chips: [] as Chip[] };
	const listeners = { events: new Set<(e: DayEvent) => void>(), settings: new Set<() => void>() };
	const settings: Record<string, string> = { 'week-start': 'monday' };
	const app: JournalApp = {
		async api(path, init) {
			if (init?.method === 'POST') {
				const e = init.body as Extract<Edit, { op: 'replace' }>;
				calls.edits.push(e);
				return { ok: true, day: dayOf(e.date, e.after.includes('[x]')), undo: { op: 'range', date: e.date, start: e.start, end: e.end, before: e.after, after: e.before } };
			}
			calls.gets.push(path);
			const q = new URLSearchParams(path.split('?')[1]);
			const days: Day[] = [];
			for (let d = q.get('from')!; d <= q.get('to')!; d = addDays(d, 1)) days.push(dayOf(d));
			return days;
		},
		events: (fn) => (listeners.events.add(fn), () => void listeners.events.delete(fn)),
		addToChat: (chip) => void calls.chips.push(chip),
		settings: {
			get: (k) => settings[k],
			on: (fn) => (listeners.settings.add(fn), () => void listeners.settings.delete(fn)),
		},
	};
	const emit = (date: string) => { for (const fn of listeners.events) fn({ ref: { date } }); };
	return { app, calls, listeners, settings, emit };
}

const q = (root: HTMLElement, sel: string) => root.querySelector(sel) as unknown as FakeElement;

async function mounted() {
	const root = newRoot();
	const host = fakeApp();
	const view = mount(root, host.app);
	await settle();
	return { root, view, ...host };
}

describe('mount', () => {
	before(() => installDom());

	it('opens on the proof’s sample week and draws its days', async () => {
		const m = await mounted();
		const week = { from: SAMPLE_WEEK, to: addDays(SAMPLE_WEEK, 6) };
		assert.deepEqual(m.calls.gets, [`/days?from=${week.from}&to=${week.to}`]);
		assert.equal(m.root.querySelectorAll('.day').length, 7);
		assert.equal(q(m.root, '[data-range="from"]').value, week.from);
		assert.deepEqual(m.view.pageChip().ref, week);
		assert.deepEqual(m.view.pageChip(), { kind: 'days', ref: week, label: 'Mon 28 Sep – Sun 4 Oct', detail: '7 days' });
		m.view.unmount();
	});

	it('two mounts in one page share nothing: range, hint, toast, chips', async () => {
		const a = await mounted();
		const b = await mounted();
		// Their hints are their own, and every block points at its own mount's.
		const hintA = q(a.root, '.edit-hint').id;
		const hintB = q(b.root, '.edit-hint').id;
		assert.notEqual(hintA, hintB);
		assert.ok([...a.root.querySelectorAll('.block')].every((n) => n.getAttribute('aria-describedby') === hintA));
		assert.ok([...b.root.querySelectorAll('.block')].every((n) => n.getAttribute('aria-describedby') === hintB));

		// Moving A on leaves B where it was.
		fire(q(a.root, '[data-range="next"]'), 'click');
		await settle();
		const weekA = shift({ from: SAMPLE_WEEK, to: addDays(SAMPLE_WEEK, 6) }, 1);
		assert.deepEqual(a.view.pageChip().ref, weekA);
		assert.deepEqual(b.view.pageChip().ref, { from: SAMPLE_WEEK, to: addDays(SAMPLE_WEEK, 6) });

		// Ticking a to-do in B saves through B's host and shows B's toast only.
		const box = q(b.root, 'input.todo');
		box.checked = true;
		fire(box, 'click');
		await settle();
		assert.equal(b.calls.edits.length, 1);
		assert.equal(a.calls.edits.length, 0);
		assert.match(b.calls.edits[0]!.op === 'replace' ? b.calls.edits[0]!.after : '', /\[x\]/);
		assert.equal(q(b.root, '.toast').querySelector('span')!.textContent, 'Done.');
		assert.ok(!q(b.root, '.toast').hidden);
		assert.ok(q(a.root, '.toast').hidden);

		// A change event reaches only the mount whose host sent it, and only for a day it shows.
		const before = a.calls.gets.length;
		a.emit(weekA.from);
		b.emit(addDays(SAMPLE_WEEK, 30));
		await settle();
		assert.deepEqual(a.calls.gets.slice(before), [`/days?from=${weekA.from}&to=${weekA.from}`]);
		assert.equal(b.calls.gets.length, 1);
		a.view.unmount();
		b.view.unmount();
	});

	it('the paper follows its setting, live', async () => {
		const m = await mounted();
		assert.equal(q(m.root, '.paper').getAttribute('data-paper'), 'follow');
		m.settings.paper = 'dark';
		for (const fn of m.listeners.settings) fn();
		assert.equal(q(m.root, '.paper').getAttribute('data-paper'), 'dark');
		m.view.unmount();
	});

	it('reveal brings a day into view and marks the block', async () => {
		const m = await mounted();
		const far = addDays(SAMPLE_WEEK, 10);
		await m.view.reveal({ date: far, key: `${far}:## 08:00` });
		const { from, to } = m.view.pageChip().ref as { from: string; to: string };
		assert.ok(from <= far && far <= to && spanOf(from, to) === 7);
		assert.ok(q(m.root, `.block[data-key="${far}:## 08:00"]`).classList.contains('fresh'));
		await m.view.reveal({ from: far, to: far });
		assert.ok(q(m.root, `.day[data-date="${far}"]`).classList.contains('fresh'));
		m.view.unmount();
	});

	it('unmount leaves nothing behind and stops listening', async () => {
		const m = await mounted();
		m.view.unmount();
		assert.equal(m.root.childNodes.length, 0);
		assert.ok(!m.root.classList.contains('journal'));
		assert.equal(m.listeners.events.size, 0);
		assert.equal(m.listeners.settings.size, 0);
		assert.equal((m.root as unknown as FakeElement).listenerCount(), 0);
		const gets = m.calls.gets.length;
		m.emit(SAMPLE_WEEK);
		await settle();
		assert.equal(m.calls.gets.length, gets);
	});
});
