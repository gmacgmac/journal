// The running journal's sheet: days newest first. The recent days (today and the six before it) are always on it, a day
// with no page as one line; before them, only days that have a page, read a batch at a time. Between two days that are not
// next to each other, a gap marker says how many days lie between and offers to add a page in them; at the foot, Earlier
// pages while there are more. All of it is laid out from the sections on the sheet, so a day put in or taken out anywhere
// only needs `layout` again.
import { addDays, dateTitle, daysBetween } from '../format/index.ts';
import { dayMonth } from './dates.ts';
import { dateField } from './picker.ts';
import { el } from './render.ts';
import type { Day } from './wire.ts';
import { say } from './words.ts';

/** How many older pages one read asks for. */
export const PAGE_BATCH = 10;

/** A day with no page, as the routes answer one. */
export const noPage = (date: string): Day => ({ date, title: dateTitle(date), exists: false, version: null, blocks: [], problems: [] });

export const sectionsOf = (sheet: HTMLElement): HTMLElement[] => [...sheet.querySelectorAll<HTMLElement>(':scope > .day')];

/** Puts `section` on the sheet in its place, newest first. */
export function placeSection(sheet: HTMLElement, section: HTMLElement): void {
	const date = section.dataset.date!;
	const older = sectionsOf(sheet).find((s) => s.dataset.date! < date) ?? sheet.querySelector(':scope > .feed-end');
	sheet.insertBefore(section, older);
}

/** The marker between `newer` and `older`, or null when they are next to each other. */
export function gapMarker(newer: string, older: string): HTMLElement | null {
	const from = addDays(older, 1);
	const to = addDays(newer, -1);
	const count = from <= to ? daysBetween(from, to) : 0;
	if (count < 1) return null;
	const add = el('button', [say('journal.view.add.page')], {
		type: 'button', class: 'gap-add', 'aria-label': say('journal.view.gap.add', { from: dayMonth(from), to: dayMonth(to) }),
	});
	return el('div', [
		el('span', [say(count === 1 ? 'journal.view.gap.day' : 'journal.view.gap.days', { count })], { class: 'gap-count' }),
		el('span', [add, dateField(say('journal.view.add.pick'))], { class: 'picker-anchor' }),
	], { class: 'gap-marker', 'data-from': from, 'data-to': to });
}

/**
 * Lays the sheet out again. An older day with no page goes, unless it is being written in or the person just put it
 * there to write in (`placed`); a gap marker goes between every two days that are not next to each other; and the foot
 * offers Earlier pages while `more`. Answers the dates taken off.
 */
export function layout(sheet: HTMLElement, opts: { recentFrom: string; more: boolean }): string[] {
	for (const m of sheet.querySelectorAll(':scope > .gap-marker')) m.remove();
	const gone: string[] = [];
	for (const s of sectionsOf(sheet)) {
		const keep = !s.classList.contains('gap') || s.dataset.date! >= opts.recentFrom || s.classList.contains('drafting') || s.classList.contains('placed');
		if (!keep) {
			gone.push(s.dataset.date!);
			s.remove();
		}
	}
	const list = sectionsOf(sheet);
	for (let i = 0; i + 1 < list.length; i += 1) {
		const marker = gapMarker(list[i]!.dataset.date!, list[i + 1]!.dataset.date!);
		if (marker !== null) list[i]!.after(marker);
	}
	const foot = sheet.querySelector(':scope > .feed-end');
	if (!opts.more) foot?.remove();
	else if (foot === null) sheet.append(el('div', [el('button', [say('journal.view.more')], { type: 'button', class: 'feed-more' })], { class: 'feed-end' }));
	return gone;
}
