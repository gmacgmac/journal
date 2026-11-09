// WHAT IS ON THE SHEET, AND WHERE THE PERSON IS. Two views of one journal:
//   journal  the running journal, newest first: the recent days, every one, then the older days that have a page, a
//            batch at a time as the person scrolls (`feed.ts`); it opens at the top, today
//   day      one day, alone, for reading or writing a long one; the toolbar steps a day at a time
// The place (the view, and the day in it) is kept through the host's store (`place.ts`), so the pane opens where the
// person left it, and on today once the date has moved on. Every read is numbered, so only the newest draws; writing that
// is open is saved before the sheet is drawn again, and a sheet that cannot be saved over stays.
import { addDays, daysBetween, localToday } from '../format/index.ts';
import type { PluginStore } from '../vendor/plugin-host/plugin-host.ts';
import { daySection, patchDay } from './days.ts';
import { recentDays, RECENT_DAYS, type Range } from './dates.ts';
import { layout, PAGE_BATCH, placeSection, sectionsOf } from './feed.ts';
import { keepPlace, readPlace, type Place } from './place.ts';
import type { Page } from './session.ts';
import type { Toolbar } from './toolbar.ts';
import type { Day, Routes } from './wire.ts';
import { say } from './words.ts';

/** How many batches a kept place may read on to find its day again, before it settles for where it got to. */
const FIND_BATCHES = 12;
/** How close to the foot of the sheet, in pixels, the next batch is read. */
const READ_AHEAD_PX = 900;

export interface ViewsDeps {
	paper: HTMLElement;
	sheet: HTMLElement;
	routes: Routes;
	page: Page;
	toolbar: Toolbar;
	store: PluginStore;
	live: { on: boolean };
	notify(text: string, tone?: 'info' | 'error'): void;
	/** What is on show may have changed: the view, its days, or what they hold. Said often; the mount works out the rest. */
	onShow(): void;
}

export function createViews(d: ViewsDeps) {
	const { paper, sheet, routes, page, toolbar } = d;
	let place: Place = readPlace(d.store, localToday());
	let shown = new Map<string, Day>();
	/** The running journal: the first of its recent days, and where to read older pages on from (null: none left). */
	const feed = { recentFrom: '', next: null as string | null, reading: false };
	let seq = 0;
	/** The draw under way, if any: what reaches into the sheet waits for it, so a draw never wipes what was put in. */
	let drawing: Promise<boolean> = Promise.resolve(true);
	let topTimer: ReturnType<typeof setTimeout> | undefined;

	const sectionOf = (date: string) => sheet.querySelector<HTMLElement>(`.day[data-date="${date}"]`);

	function setPlace(p: Place): void {
		place = p;
		const today = localToday();
		keepPlace(d.store, p, today);
		toolbar.show(p, today);
		d.onShow();
	}

	/** In the running journal: the layout again, and the days it took off forgotten. Said as a change to what is on show. */
	function relayout(): void {
		if (place.view === 'journal') {
			for (const date of layout(sheet, { recentFrom: feed.recentFrom, more: feed.next !== null })) shown.delete(date);
		}
		d.onShow();
	}

	/** Saves what is open first; false when it could not be, and the sheet must stay. */
	async function writingClosed(): Promise<boolean> {
		const open = page.sessions.current;
		return open === null || (await open.finish({ then: 'stay' })) === null;
	}

	/**
	 * After a read, whether read `n` may still draw: the mount is live, no newer read began, and writing opened while it was
	 * reading is saved first (the sheet is never drawn over an open editor).
	 */
	async function stillWanted(n: number): Promise<boolean> {
		if (!d.live.on || n !== seq) return false;
		if (page.sessions.current !== null && !(await writingClosed())) return false;
		return d.live.on && n === seq;
	}

	function showJournal(top: string | null = null): Promise<boolean> {
		return (drawing = drawJournal(top));
	}

	async function drawJournal(top: string | null): Promise<boolean> {
		const n = (seq += 1);
		if (!(await writingClosed())) return false;
		const today = localToday();
		const recent = recentDays(today);
		const [r, older] = await Promise.all([routes.days(recent.from, recent.to), routes.pages(recent.from, PAGE_BATCH)]);
		if (!(await stillWanted(n))) return false;
		if (!r.ok) return (d.notify(r.reason), false);
		if (!older.ok) d.notify(older.reason);
		const days = [...r.days].reverse().concat(older.ok ? older.days : []);
		feed.recentFrom = recent.from;
		feed.next = older.ok ? older.next : null;
		shown = new Map(days.map((day) => [day.date, day]));
		sheet.dataset.view = 'journal';
		sheet.replaceChildren(...days.map((day) => daySection(day, page.hintId, today)));
		setPlace({ view: 'journal', date: top });
		relayout();
		if (top === null) paper.scrollTop = 0;
		else await find(top);
		return true;
	}

	function showDay(date: string): Promise<boolean> {
		return (drawing = drawDay(date));
	}

	async function drawDay(date: string): Promise<boolean> {
		const n = (seq += 1);
		if (!(await writingClosed())) return false;
		const r = await routes.days(date, date);
		if (!(await stillWanted(n))) return false;
		const day = r.ok ? r.days[0] : undefined;
		if (day === undefined) return (d.notify(r.ok ? say('journal.view.unreadable') : r.reason), false);
		shown = new Map([[date, day]]);
		sheet.dataset.view = 'day';
		sheet.replaceChildren(daySection(day, page.hintId));
		setPlace({ view: 'day', date });
		paper.scrollTop = 0;
		return true;
	}

	/** The next batch of older pages, at the foot of the running journal; false when nothing more came. */
	async function readOlder(): Promise<boolean> {
		if (place.view !== 'journal' || feed.next === null || feed.reading) return false;
		feed.reading = true;
		const n = seq;
		const r = await routes.pages(feed.next, PAGE_BATCH);
		feed.reading = false;
		if (!d.live.on || n !== seq) return false;
		if (!r.ok) return (d.notify(r.reason), false);
		feed.next = r.next;
		for (const day of r.days) {
			if (shown.has(day.date)) continue;
			shown.set(day.date, day);
			placeSection(sheet, daySection(day, page.hintId));
		}
		relayout();
		return r.days.length > 0;
	}

	/** Reads on until `date` is on the sheet, or as far as `FIND_BATCHES` go, then puts it at the top. */
	async function find(date: string): Promise<void> {
		for (let i = 0; i < FIND_BATCHES && sectionOf(date) === null && feed.next !== null && feed.next > date; i += 1) {
			if (!(await readOlder())) break;
		}
		sectionOf(date)?.scrollIntoView({ block: 'start' });
	}

	/** `day` on the running journal's sheet, in its place: drawn when it is not there. */
	function ensure(day: Day): HTMLElement {
		const there = sectionOf(day.date);
		if (there !== null) return there;
		const section = daySection(day, page.hintId);
		// A day with no page, put here to write in, stays until the journal is drawn again.
		if (!day.exists) section.classList.add('placed');
		shown.set(day.date, day);
		placeSection(sheet, section);
		relayout();
		return section;
	}

	/** Brings `date` onto the sheet, in whichever view is showing; its section, or null when it could not be read. */
	async function reach(date: string): Promise<HTMLElement | null> {
		await drawing;
		if (place.view === 'day') return place.date === date || (await showDay(date)) ? sectionOf(date) : null;
		if (shown.has(date)) return sectionOf(date);
		const n = seq;
		const r = await routes.days(date, date);
		if (!d.live.on || n !== seq || place.view !== 'journal') return null;
		const day = r.ok ? r.days[0] : undefined;
		if (day === undefined) return (d.notify(r.ok ? say('journal.view.unreadable') : r.reason), null);
		return ensure(day);
	}

	/** The days `range` names that have a page, brought onto the running journal; the newest one's section. */
	async function reachRange(range: Range): Promise<HTMLElement | null> {
		await drawing;
		if (place.view === 'day' && !(await showJournal())) return null;
		const from = daysBetween(range.from, range.to) > RECENT_DAYS * 2 ? addDays(range.to, -(RECENT_DAYS * 2 - 1)) : range.from;
		const n = seq;
		const r = await routes.days(from, range.to);
		if (!d.live.on || n !== seq || place.view !== 'journal') return null;
		if (!r.ok) return (d.notify(r.reason), null);
		for (const day of r.days) if (day.exists || day.date >= feed.recentFrom) ensure(day);
		return sectionsOf(sheet).find((s) => s.dataset.date! <= range.to && s.dataset.date! >= from) ?? null;
	}

	/**
	 * A change to `date` from anyone: the day read again where it is shown; a new page the journal reaches, drawn in; and a
	 * day after the newest one shown (the pane stayed open past midnight), the journal drawn again round the new today.
	 */
	async function changed(date: string): Promise<void> {
		await drawing;
		if (shown.has(date)) return page.refresh(date);
		if (place.view !== 'journal') return;
		if (date > addDays(feed.recentFrom, RECENT_DAYS - 1) && date <= localToday()) return void showJournal(place.date);
		const reaches = date < feed.recentFrom && (feed.next === null || date > feed.next);
		if (!reaches) return;
		const n = seq;
		const r = await routes.days(date, date);
		const day = r.ok ? r.days[0] : undefined;
		if (!d.live.on || n !== seq || place.view !== 'journal' || day === undefined || !day.exists || shown.has(date)) return;
		ensure(day).classList.add('fresh');
	}

	/** Every day shown, read again and patched in place: the sheet does not move. */
	async function reread(): Promise<void> {
		const dates = [...shown.keys()];
		if (place.view === 'journal') {
			const r = await routes.days(feed.recentFrom, addDays(feed.recentFrom, RECENT_DAYS - 1));
			if (r.ok) for (const day of r.days) page.patch(day);
		}
		for (const date of dates.filter((date) => place.view === 'day' || date < feed.recentFrom)) await page.refresh(date);
	}

	/** `day` as it now is, kept and patched where it is shown. */
	function patch(day: Day, fresh: boolean): void {
		if (shown.has(day.date)) shown.set(day.date, day);
		patchDay(day, sectionOf(day.date), fresh, page.hintId);
		relayout();
	}

	/** On scroll: the next batch when near the foot, and the day at the top kept as the place, once scrolling rests. */
	function scrolled(): void {
		if (place.view !== 'journal') return;
		if (paper.scrollTop + paper.clientHeight > paper.scrollHeight - READ_AHEAD_PX) void readOlder();
		clearTimeout(topTimer);
		topTimer = setTimeout(() => {
			if (place.view !== 'journal') return;
			const edge = paper.getBoundingClientRect().top;
			const first = sectionsOf(sheet).find((s) => s.getBoundingClientRect().bottom > edge + 1);
			const top = paper.scrollTop < 8 ? null : (first?.dataset.date ?? null);
			if (top !== place.date) setPlace({ view: 'journal', date: top });
		}, 300);
	}

	return {
		get place() { return place; },
		get shown(): ReadonlyMap<string, Day> { return shown; },
		/** The recent days of the running journal, or the one day. */
		get range(): Range {
			return place.view === 'day' ? { from: place.date, to: place.date } : { from: feed.recentFrom, to: addDays(feed.recentFrom, RECENT_DAYS - 1) };
		},
		sectionOf,
		open: () => (place.view === 'day' ? showDay(place.date) : showJournal(place.date)),
		showJournal,
		showDay,
		readOlder,
		reach,
		reachRange,
		changed,
		reread,
		patch,
		scrolled,
		dispose: () => clearTimeout(topTimer),
	};
}

export type Views = ReturnType<typeof createViews>;
