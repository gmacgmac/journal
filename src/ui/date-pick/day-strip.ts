// A row of days to pick one from, for a short span (the days between two pages, say): a group of buttons the arrow keys
// move between, each named in full for readers. An optional last button offers another day (the caller opens a calendar).
// It draws only inside its own element and imports nothing outside this folder.
import { format, type IsoDate } from './dates.ts';
import { h } from './h.ts';

export interface DayStripOptions {
	/** The days offered, in the order shown. */
	dates: IsoDate[];
	locale?: string;
	/** What a day's button shows; its accessible name is always the whole date. Weekday and day when left out ("Fri 6"). */
	short?: Intl.DateTimeFormatOptions;
	/** The group's accessible name, and the words of the button for another day (shown only with `onMore`). */
	labels: { group: string; more?: string };
	onPick(date: IsoDate): void;
	onMore?(): void;
}

export interface DayStrip {
	readonly el: HTMLElement;
	/** Puts focus on the first day. */
	focus(): void;
}

export function createDayStrip(o: DayStripOptions): DayStrip {
	const short = o.short ?? { weekday: 'short', day: 'numeric' };
	const days = o.dates.map((d) => h('button', {
		type: 'button', class: 'dp-chip', 'data-date': d,
		'aria-label': format(d, o.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
	}, [format(d, o.locale, short)]));
	const more = o.onMore !== undefined && o.labels.more !== undefined ? [h('button', { type: 'button', class: 'dp-chip dp-more' }, [o.labels.more])] : [];
	const buttons = [...days, ...more];
	const el = h('div', { class: 'dp-strip', role: 'group', 'aria-label': o.labels.group }, buttons);

	el.addEventListener('click', (e) => {
		const b = (e.target as Element).closest<HTMLElement>('.dp-chip');
		if (b === null) return;
		if (b.classList.contains('dp-more')) return o.onMore?.();
		o.onPick(b.dataset.date!);
	});
	el.addEventListener('keydown', (e) => {
		const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
		const at = buttons.indexOf(e.target as HTMLButtonElement);
		if (step === 0 || at < 0) return;
		e.preventDefault();
		buttons[(at + step + buttons.length) % buttons.length]!.focus();
	});
	return { el, focus: () => buttons[0]?.focus() };
}
