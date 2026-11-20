// Save as PDF (nclite's handovers, 2026-11-19 and 20): the control only when the host can save a PDF; each choice hands the host
// the right days, under the right title, in an element for paper with no control in it; a failure is said, a cancel is not.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { addDays, dateTitle, localToday } from '../../src/format/index.ts';
import type { PdfAsk } from '../../src/vendor/plugin-host/plugin-host.ts';
import { say } from '../../src/view/words.ts';
import { fire, installDom, settle, type FakeElement } from './fake-dom.ts';
import { fakeHost, fileOf, mounted, pickDay } from './fake-host.ts';

const q = (root: unknown, sel: string) => (root as HTMLElement).querySelector(sel) as unknown as FakeElement;

/** A mount whose host can print: every ask kept, answered by `answer` (a cancelled print resolves too). */
async function printable(setup: (h: ReturnType<typeof fakeHost>) => void = () => {}, answer: () => Promise<void> = async () => {}) {
	const asks: PdfAsk[] = [];
	const m = await mounted((h) => {
		h.host.savePdf = (ask) => (asks.push(ask!), answer());
		setup(h);
	});
	return { ...m, asks };
}

/** The dates, titles and words an ask's content holds, and whether anything in it could be pressed. */
function read(ask: PdfAsk) {
	const c = ask.content as HTMLElement;
	return {
		classes: c.getAttribute('class'),
		dates: [...c.querySelectorAll('.print-date')].map((h) => h.textContent),
		text: c.textContent ?? '',
		controls: c.querySelectorAll('button, input, select, textarea, a, [contenteditable], [tabindex]').length,
	};
}

const choose = async (root: HTMLElement, kind: string) => {
	fire(q(root, '[data-pdf]'), 'click');
	fire(q(root, `[data-choice="${kind}"]`), 'click');
	await settle();
	await settle();
};

describe('Save as PDF', () => {
	before(installDom);

	it('no Save as PDF control at all when the host cannot save one', async () => {
		const m = await mounted();
		assert.equal(m.root.querySelector('[data-pdf]'), null);
		m.view.unmount();
	});

	it('This day saves the day on screen, under its date, with links as words and no control in it', async () => {
		const today = localToday();
		const m = await printable((h) => h.files.set(today, fileOf(today, '## 08:00 · Morning', 'A [link](https://example.com) here.', '- [x] done\n- [ ] not yet')));
		assert.ok(m.root.querySelector('[data-pdf]'));
		await choose(m.root, 'day');
		assert.equal(m.asks.length, 1);
		const got = read(m.asks[0]!);
		assert.equal(m.asks[0]!.title, say('journal.view.pdf.titleDay', { date: dateTitle(today) }));
		assert.equal(got.classes, 'journal journal-print');
		assert.deepEqual(got.dates, [dateTitle(today)]);
		assert.match(got.text, /08:00.*Morning/);
		assert.match(got.text, /A link here\./);
		assert.match(got.text, /☑ done.*☐ not yet/);
		assert.equal(got.controls, 0);
		// Each entry is one piece for paper: its heading and all its writing, kept together (journal.css).
		const items = [...(m.asks[0]!.content as HTMLElement).querySelectorAll('.print-item')];
		assert.equal(items.length, 1);
		assert.equal(items[0]!.querySelectorAll('.print-block').length, 2);
		m.view.unmount();
	});

	it('a range saves the days in it that have a page, oldest first', async () => {
		const today = localToday();
		const [a, b, c] = [addDays(today, -40), addDays(today, -20), addDays(today, -2)];
		const m = await printable((h) => { for (const d of [a, b, c]) h.files.set(d, fileOf(d, '## 09:00', `On ${d}.`)); });
		fire(q(m.root, '[data-pdf]'), 'click');
		fire(q(m.root, '[data-choice="range"]'), 'click');
		await pickDay(m.root, addDays(a, -1));
		await pickDay(m.root, addDays(today, -5));
		await settle();
		assert.equal(m.asks.length, 1);
		assert.deepEqual(read(m.asks[0]!).dates, [dateTitle(a), dateTitle(b)]);
		assert.match(m.asks[0]!.title ?? '', /^Journal, /);
		m.view.unmount();
	});

	it('Everything saves every page, oldest first, read a batch at a time', async () => {
		const today = localToday();
		const dates = Array.from({ length: 40 }, (_, i) => addDays(today, -3 * i - 1));
		const m = await printable((h) => { for (const d of dates) h.files.set(d, fileOf(d, '## Notes', 'Then.')); });
		await choose(m.root, 'all');
		assert.equal(m.asks[0]!.title, say('journal.view.pdf.titleAll'));
		assert.deepEqual(read(m.asks[0]!).dates, [...dates].reverse().map(dateTitle));
		m.view.unmount();
	});

	it('the colours: black and white by default; the theme, light or dark, carries its mode; the choice is kept', async () => {
		const today = localToday();
		const m = await printable((h) => h.files.set(today, fileOf(today, '## 08:00', 'Hi.')));
		await choose(m.root, 'day');
		assert.equal((m.asks[0]!.content as HTMLElement).getAttribute('data-look'), 'plain');
		assert.equal(m.asks[0]!.look, 'plain', 'the host is told the look, so it sets the page: a margin for plain');
		fire(q(m.root, '[data-pdf]'), 'click');
		assert.equal(q(m.root, '[data-look="plain"]').getAttribute('aria-checked'), 'true');
		fire(q(m.root, '[data-look="dark"]'), 'click');
		assert.equal(q(m.root, '[data-look="dark"]').getAttribute('aria-checked'), 'true');
		fire(q(m.root, '[data-choice="day"]'), 'click');
		await settle();
		await settle();
		const dark = (m.asks[1]!.content as HTMLElement) as unknown as FakeElement & { style: { props: Map<string, string> } };
		assert.equal(dark.getAttribute('data-look'), 'dark');
		assert.equal(m.asks[1]!.look, 'dark', 'and none for light or dark, edge to edge');
		assert.equal(dark.style.props.get('--host-color-scheme'), 'dark');
		m.view.unmount();
		// Kept on this device: the next mount offers it first.
		const again = await printable((h) => { h.useStore(new Map([['printLook', 'dark']])); });
		fire(q(again.root, '[data-pdf]'), 'click');
		assert.equal(q(again.root, '[data-look="dark"]').getAttribute('aria-checked'), 'true');
		again.view.unmount();
	});

	it('a choice with nothing to save says so and cannot be pressed: the day on screen, or all of them with no pages', async () => {
		const older = addDays(localToday(), -3);
		const m = await printable((h) => h.files.set(older, fileOf(older, '## 08:00', 'Then.')));
		fire(q(m.root, '[data-pdf]'), 'click');
		await settle();
		await settle();
		const state = () => ['day', 'range', 'all'].map((k) => {
			const b = q(m.root, `[data-choice="${k}"]`) as unknown as HTMLButtonElement;
			return [b.disabled, b.querySelector('.pdf-note')!.textContent];
		});
		assert.deepEqual(state().map(([off]) => off), [true, false, false], 'today has no page; older days do');
		assert.equal(state()[0]![1], say('journal.view.pdf.empty'));
		m.view.unmount();

		const bare = await printable();
		fire(q(bare.root, '[data-pdf]'), 'click');
		await settle();
		await settle();
		for (const k of ['day', 'range', 'all']) assert.equal((q(bare.root, `[data-choice="${k}"]`) as unknown as HTMLButtonElement).disabled, true, k);
		bare.view.unmount();
	});

	it('nothing written is said, and no PDF is made', async () => {
		const m = await printable();
		await choose(m.root, 'day');
		assert.equal(m.asks.length, 0);
		assert.deepEqual(m.calls.notes, [[say('journal.view.pdf.nothing'), 'info']]);
		m.view.unmount();
	});

	it('the control waits while saving; a PDF that cannot be saved is said, a cancelled one is not', async () => {
		const today = localToday();
		let finish: () => void = () => {};
		const m = await printable((h) => h.files.set(today, fileOf(today, '## 08:00', 'Hi.')), () => new Promise<void>((r) => (finish = r)));
		await choose(m.root, 'day');
		assert.equal((q(m.root, '[data-pdf]') as unknown as HTMLButtonElement).disabled, true);
		finish();
		await settle();
		assert.equal((q(m.root, '[data-pdf]') as unknown as HTMLButtonElement).disabled, false);
		assert.deepEqual(m.calls.notes, [], 'printed or cancelled: nothing said');
		m.view.unmount();

		const failing = await printable((h) => h.files.set(today, fileOf(today, '## 08:00', 'Hi.')), () => Promise.reject(new Error('no printer')));
		await choose(failing.root, 'day');
		await settle();
		assert.deepEqual(failing.calls.notes, [[say('journal.view.pdf.failed'), 'error']]);
		failing.view.unmount();
	});
});
