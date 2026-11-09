// The running journal's sheet: days newest first. Today is always on it, as one line with the way to start it when it has
// no page; every other day is on it only when it has a page (GM, 2026-11-09: no row per empty day), the recent days read
// at once and the older a batch at a time. Between two days that are not
// next to each other, a gap marker offers to add a page in them; at the foot, Earlier
// pages while there are more. All of it is laid out from the sections on the sheet, so a day put in or taken out anywhere
// only needs `layout` again.
import { addDays, daysBetween } from '../format/index.ts';
import { dayMonth } from './dates.ts';
import { icon } from './icons.ts';
import { el } from './render.ts';
import { say } from './words.ts';

/** How many older pages one read asks for. */
export const PAGE_BATCH = 10;

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
	const add = el('button', [icon('plus'), say('journal.view.add.page')], {
		type: 'button', class: 'gap-add', 'aria-haspopup': 'dialog', 'aria-label': say('journal.view.gap.add', { from: dayMonth(from), to: dayMonth(to) }),
	});
	// Only the way to add a page: how many days lie between is not worth a line of its own (GM, 2026-11-09).
	return el('div', [add], { class: 'gap-marker', 'data-from': from, 'data-to': to });
}

/**
 * Lays the sheet out again. A day with no page goes, unless it is today, is being written in, or the person just put it
 * there to write in (`placed`); a gap marker goes between every two days that are not next to each other; and the foot
 * offers Earlier pages while `more`. Answers the dates taken off.
 */
export function layout(sheet: HTMLElement, opts: { today: string; more: boolean }): string[] {
	const gone: string[] = [];
	for (const s of sectionsOf(sheet)) {
		const keep = !s.classList.contains('gap') || s.dataset.date === opts.today || s.classList.contains('drafting') || s.classList.contains('placed');
		if (!keep) {
			gone.push(s.dataset.date!);
			s.remove();
		}
	}
	// A marker that is already right stays (focus on its Add a page, or its open date field, is kept); the rest are made
	// again or taken off.
	const list = sectionsOf(sheet);
	const kept = new Set<Element>();
	for (let i = 0; i + 1 < list.length; i += 1) {
		const marker = gapMarker(list[i]!.dataset.date!, list[i + 1]!.dataset.date!);
		if (marker === null) continue;
		const there = list[i]!.nextElementSibling as HTMLElement | null;
		const same = there?.classList.contains('gap-marker') === true && there.dataset.from === marker.dataset.from && there.dataset.to === marker.dataset.to;
		if (same) kept.add(there!);
		else {
			list[i]!.after(marker);
			kept.add(marker);
		}
	}
	for (const m of sheet.querySelectorAll(':scope > .gap-marker')) if (!kept.has(m)) m.remove();
	const foot = sheet.querySelector(':scope > .feed-end');
	if (!opts.more) foot?.remove();
	else if (foot === null) sheet.append(el('div', [el('button', [say('journal.view.more')], { type: 'button', class: 'feed-more' })], { class: 'feed-end' }));
	return gone;
}
