// The date-pick package on its own (src/ui/date-pick/README.md): the calendar's grid and keys, its range and dots, the
// day strip, and when the popover closes and where focus goes. It is used here exactly as another app would use it.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createCalendar, createDayStrip, openPopover, type IsoDate } from '../../src/ui/date-pick/index.ts';
import { addMonths, format, isIsoDate, shiftMonths } from '../../src/ui/date-pick/dates.ts';

/** A day's full name, as Intl writes it for the locale the tests use. */
const full = (d: IsoDate) => format(d, 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
import { fire, installDom, newRoot, type FakeElement } from '../view/fake-dom.ts';

const LABELS = { prev: 'Previous month', next: 'Next month', marked: 'has a page' };
const days = (el: HTMLElement) => [...el.querySelectorAll('.dp-day')].map((b) => b.getAttribute('data-date'));
const day = (el: HTMLElement, d: IsoDate) => el.querySelector(`.dp-day[data-date="${d}"]`) as unknown as FakeElement;
const focusedDate = () => (document.activeElement as unknown as FakeElement | null)?.getAttribute('data-date');

describe('date-pick', () => {
	before(() => installDom());

	it('dates: months step on the same day, held to the month’s last', () => {
		assert.equal(shiftMonths('2026-01-31', 1), '2026-02-28');
		assert.equal(shiftMonths('2026-03-15', -14), '2025-01-15');
		assert.equal(addMonths('2026-12-09', 1), '2027-01-01');
		assert.ok(isIsoDate('2028-02-29') && !isIsoDate('2026-02-29') && !isIsoDate('2026-1-1'));
	});

	it('the calendar shows the value’s month, weeks from Monday, today marked current and one day in the tab order', () => {
		const picked: IsoDate[] = [];
		const cal = createCalendar({ value: '2026-11-09', today: '2026-11-09', labels: LABELS, locale: 'en-GB', onPick: (d) => picked.push(d) });
		const all = days(cal.el);
		assert.equal(all.length, 30);
		assert.equal(cal.el.querySelectorAll('td').length % 7, 0, 'whole weeks');
		const first = cal.el.querySelector('tbody')!.querySelector('tr')!;
		assert.equal(first.querySelectorAll('.dp-day').length, 1, '1 November 2026 is a Sunday: the last of its week');
		assert.equal(day(cal.el, '2026-11-09').getAttribute('aria-current'), 'date');
		assert.deepEqual([...cal.el.querySelectorAll('.dp-day')].filter((b) => b.getAttribute('tabindex') === '0').map((b) => b.getAttribute('data-date')), ['2026-11-09']);
		assert.equal(day(cal.el, '2026-11-09').getAttribute('aria-label'), full('2026-11-09'));
		fire(day(cal.el, '2026-11-03'), 'click');
		assert.deepEqual(picked, ['2026-11-03']);
	});

	it('the calendar’s keys: arrows by a day and a week, Home and End to the week’s ends, Page keys by a month and, with Shift, a year', () => {
		const root = newRoot();
		const cal = createCalendar({ value: '2026-11-09', labels: LABELS, onPick: () => {} });
		root.append(cal.el);
		cal.focus();
		const press = (key: string, shiftKey = false) => fire(document.activeElement, 'keydown', { key, shiftKey });
		press('ArrowRight');
		assert.equal(focusedDate(), '2026-11-10');
		press('ArrowDown');
		assert.equal(focusedDate(), '2026-11-17');
		press('Home');
		assert.equal(focusedDate(), '2026-11-16', 'Monday');
		press('End');
		assert.equal(focusedDate(), '2026-11-22', 'Sunday');
		press('PageDown');
		assert.equal(focusedDate(), '2026-12-22');
		assert.equal(cal.month, '2026-12-01', 'its month is shown');
		press('PageUp', true);
		assert.equal(focusedDate(), '2025-12-22');
	});

	it('the calendar holds to min and max: days outside cannot be picked or reached, and a month wholly outside cannot be stepped to', () => {
		const picked: IsoDate[] = [];
		const root = newRoot();
		const cal = createCalendar({ value: '2026-11-09', min: '2026-11-03', max: '2026-11-09', labels: LABELS, onPick: (d) => picked.push(d) });
		root.append(cal.el);
		assert.equal(day(cal.el, '2026-11-10').getAttribute('aria-disabled'), 'true');
		fire(day(cal.el, '2026-11-10'), 'click');
		assert.deepEqual(picked, []);
		cal.focus();
		fire(document.activeElement, 'keydown', { key: 'ArrowDown' });
		assert.equal(focusedDate(), '2026-11-09', 'held at max');
		const [prev, next] = [...cal.el.querySelectorAll('.dp-step')] as unknown as FakeElement[];
		assert.ok(prev!.disabled && next!.disabled);
	});

	it('the calendar says each month it shows, and marks days given later with a dot and a word for readers', () => {
		const months: string[][] = [];
		const cal = createCalendar({ value: '2026-11-09', locale: 'en-GB', labels: LABELS, onPick: () => {}, onMonth: (a, b) => months.push([a, b]) });
		assert.deepEqual(months, [['2026-11-01', '2026-11-30']]);
		cal.mark(['2026-11-02', '2026-11-05']);
		assert.ok(day(cal.el, '2026-11-02').classList.contains('dp-marked'));
		assert.equal(day(cal.el, '2026-11-05').getAttribute('aria-label'), `${full('2026-11-05')}, has a page`);
		fire(cal.el.querySelector('.dp-step[data-step="-1"]'), 'click');
		assert.deepEqual(months.at(-1), ['2026-10-01', '2026-10-31']);
	});

	it('the day strip offers its days in order, moves with the arrows, and offers another day only when asked to', () => {
		const picked: IsoDate[] = [];
		let more = 0;
		const root = newRoot();
		const strip = createDayStrip({ dates: ['2026-11-08', '2026-11-07'], locale: 'en-GB', labels: { group: 'Which day?', more: 'Other day…' }, onPick: (d) => picked.push(d), onMore: () => (more += 1) });
		root.append(strip.el);
		const chips = [...strip.el.querySelectorAll('.dp-chip')] as unknown as FakeElement[];
		assert.deepEqual(chips.map((c) => c.textContent), [...['2026-11-08', '2026-11-07'].map((d) => format(d, 'en-GB', { weekday: 'short', day: 'numeric' })), 'Other day…']);
		assert.equal(chips[0]!.getAttribute('aria-label'), full('2026-11-08'));
		strip.focus();
		fire(document.activeElement, 'keydown', { key: 'ArrowRight' });
		assert.equal(document.activeElement, chips[1] as unknown as Element);
		fire(chips[1], 'click');
		fire(chips[2], 'click');
		assert.deepEqual([picked, more], [['2026-11-07'], 1]);
		const plain = createDayStrip({ dates: ['2026-11-08'], labels: { group: 'Which day?', more: 'Other day…' }, onPick: () => {} });
		assert.equal(plain.el.querySelector('.dp-more'), null, 'no onMore, no Other day');
	});

	it('the popover is a named dialog inside its boundary; Escape closes it and gives the button back its focus', () => {
		const root = newRoot();
		const anchor = document.createElement('button');
		root.append(anchor);
		const closed: string[] = [];
		const p = openPopover({ anchor, content: document.createElement('div'), boundary: root, label: 'Which day?', onClose: (r) => closed.push(r) });
		assert.equal(p.el.parentElement, root);
		assert.equal(p.el.getAttribute('role'), 'dialog');
		assert.equal(anchor.getAttribute('aria-expanded'), 'true');
		assert.equal(anchor.getAttribute('aria-controls'), p.el.getAttribute('id'));
		fire(p.el, 'keydown', { key: 'Escape' });
		assert.deepEqual(closed, ['escape']);
		assert.equal(p.open, false);
		assert.equal(p.el.parentElement, null);
		assert.equal(anchor.getAttribute('aria-expanded'), 'false');
		assert.equal(document.activeElement, anchor);
	});

	it('the popover closes on a press outside it, or when focus leaves it, and leaves focus where it went', () => {
		const root = newRoot();
		const anchor = document.createElement('button');
		const elsewhere = document.createElement('button');
		root.append(anchor, elsewhere);
		const closed: string[] = [];
		const a = openPopover({ anchor, content: document.createElement('div'), boundary: root, label: 'x', onClose: (r) => closed.push(r) });
		fire(document, 'pointerdown', { target: elsewhere });
		const b = openPopover({ anchor, content: document.createElement('div'), boundary: root, label: 'x', onClose: (r) => closed.push(r) });
		fire(document, 'pointerdown', { target: anchor });
		assert.equal(b.open, true, 'a press on its own button is the caller’s to handle');
		elsewhere.focus();
		fire(b.el, 'focusout', { relatedTarget: elsewhere });
		assert.deepEqual([a.open, b.open, closed], [false, false, ['outside', 'outside']]);
		assert.equal(document.activeElement, elsewhere);
	});
});
