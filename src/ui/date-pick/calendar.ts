// A month calendar to pick one day: the grid pattern of the WAI-ARIA date picker (one day button in the tab order, the
// arrow keys move between days, Page Up and Page Down between months, with Shift between years, Home and End to the
// week's ends). Days outside `min`..`max` cannot be picked; days given to `mark` carry a dot and say so to readers.
// Names of months and weekdays come from `Intl` for the `locale`; every other word is the caller's (`labels`).
// It draws only inside its own element and imports nothing outside this folder.
import { addDays, clamp, daysInMonth, format, type IsoDate, localToday, monthStart, shiftMonths, weekday } from './dates.ts';
import { h } from './h.ts';

export interface CalendarLabels {
	/** The buttons that step a month. */
	prev: string;
	next: string;
	/** Said after a marked day's date, as in "Monday 2 November 2026, has a page". */
	marked?: string;
}

export interface CalendarOptions {
	/** The day chosen at first, and the month shown; today when left out. */
	value?: IsoDate;
	min?: IsoDate;
	max?: IsoDate;
	today?: IsoDate;
	/** The first day of the week, 0 for Sunday to 6 for Saturday; Monday when left out. */
	weekStart?: number;
	locale?: string;
	labels: CalendarLabels;
	/** Days that carry a dot. More can be marked later (`mark`). */
	marked?: Iterable<IsoDate>;
	onPick(date: IsoDate): void;
	/** Said each time a month is shown, with its first and last day, so the caller can `mark` it. */
	onMonth?(first: IsoDate, last: IsoDate): void;
}

export interface Calendar {
	readonly el: HTMLElement;
	/** The first day of the month shown. */
	readonly month: IsoDate;
	/** Puts focus on the day that has it (the value, or today, in range). */
	focus(): void;
	/** Marks these days, besides those already marked. */
	mark(dates: Iterable<IsoDate>): void;
}

export function createCalendar(o: CalendarOptions): Calendar {
	const today = o.today ?? localToday();
	const start = o.weekStart ?? 1;
	const marked = new Set(o.marked ?? []);
	let focused = clamp(o.value ?? today, o.min, o.max);
	let month = monthStart(focused);

	const title = h('div', { class: 'dp-title', 'aria-live': 'polite' });
	const prev = h('button', { type: 'button', class: 'dp-step', 'data-step': '-1', 'aria-label': o.labels.prev }, ['‹']);
	const next = h('button', { type: 'button', class: 'dp-step', 'data-step': '1', 'aria-label': o.labels.next }, ['›']);
	const head = h('tr', {}, Array.from({ length: 7 }, (_, i) => {
		// 2023-01-01 was a Sunday: the day `start + i` of that week names the column.
		const d = addDays('2023-01-01', (start + i) % 7);
		return h('th', { scope: 'col', abbr: format(d, o.locale, { weekday: 'long' }) }, [format(d, o.locale, { weekday: 'narrow' })]);
	}));
	const body = h('tbody');
	const grid = h('table', { class: 'dp-grid', role: 'grid' }, [h('thead', {}, [head]), body]);
	const el = h('div', { class: 'dp-calendar' }, [h('div', { class: 'dp-head' }, [prev, title, next]), grid]);
	const titleId = `dp-title-${Math.random().toString(36).slice(2, 9)}`;
	title.setAttribute('id', titleId);
	grid.setAttribute('aria-labelledby', titleId);

	const inRange = (d: IsoDate) => (o.min === undefined || d >= o.min) && (o.max === undefined || d <= o.max);

	function draw(): void {
		const last = addDays(month, daysInMonth(month) - 1);
		title.textContent = format(month, o.locale, { month: 'long', year: 'numeric' });
		prev.disabled = o.min !== undefined && addDays(month, -1) < o.min;
		next.disabled = o.max !== undefined && addDays(last, 1) > o.max;
		const rows: HTMLElement[] = [];
		let row: HTMLElement[] = Array.from({ length: (weekday(month) - start + 7) % 7 }, () => h('td'));
		for (let d = month; d <= last; d = addDays(d, 1)) {
			row.push(h('td', {}, [dayButton(d)]));
			if (row.length === 7) {
				rows.push(h('tr', {}, row));
				row = [];
			}
		}
		if (row.length > 0) rows.push(h('tr', {}, [...row, ...Array.from({ length: 7 - row.length }, () => h('td'))]));
		body.replaceChildren(...rows);
	}

	function dayButton(d: IsoDate): HTMLElement {
		const name = format(d, o.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
		const has = marked.has(d);
		const b = h('button', {
			type: 'button', class: 'dp-day', 'data-date': d, tabindex: d === focused ? '0' : '-1',
			'aria-label': has && o.labels.marked !== undefined ? `${name}, ${o.labels.marked}` : name,
		}, [String(Number(d.slice(8)))]);
		if (has) b.classList.add('dp-marked');
		if (d === today) b.setAttribute('aria-current', 'date');
		if (d === o.value) b.setAttribute('aria-pressed', 'true');
		if (!inRange(d)) b.setAttribute('aria-disabled', 'true');
		return b;
	}

	const buttonOf = (d: IsoDate) => body.querySelector<HTMLElement>(`[data-date="${d}"]`);

	/** Moves the focus to `d` (held in range), showing its month. */
	function go(d: IsoDate): void {
		focused = clamp(d, o.min, o.max);
		if (monthStart(focused) !== month) {
			month = monthStart(focused);
			draw();
			o.onMonth?.(month, addDays(month, daysInMonth(month) - 1));
		} else {
			for (const b of body.querySelectorAll<HTMLElement>('.dp-day')) b.tabIndex = b.dataset.date === focused ? 0 : -1;
		}
		buttonOf(focused)?.focus();
	}

	const KEYS: Record<string, (d: IsoDate, shift: boolean) => IsoDate> = {
		ArrowLeft: (d) => addDays(d, -1),
		ArrowRight: (d) => addDays(d, 1),
		ArrowUp: (d) => addDays(d, -7),
		ArrowDown: (d) => addDays(d, 7),
		Home: (d) => addDays(d, -((weekday(d) - start + 7) % 7)),
		End: (d) => addDays(d, 6 - ((weekday(d) - start + 7) % 7)),
		PageUp: (d, shift) => shiftMonths(d, shift ? -12 : -1),
		PageDown: (d, shift) => shiftMonths(d, shift ? 12 : 1),
	};

	grid.addEventListener('keydown', (e) => {
		const move = KEYS[e.key];
		if (move === undefined) return;
		e.preventDefault();
		go(move(focused, e.shiftKey));
	});
	grid.addEventListener('click', (e) => {
		const b = (e.target as Element).closest<HTMLElement>('.dp-day');
		if (b === null || b.getAttribute('aria-disabled') === 'true') return;
		o.onPick(b.dataset.date!);
	});
	el.addEventListener('click', (e) => {
		const step = (e.target as Element).closest<HTMLButtonElement>('.dp-step');
		if (step === null || step.disabled) return;
		const to = shiftMonths(focused, Number(step.dataset.step));
		focused = clamp(to, o.min, o.max);
		month = monthStart(to);
		draw();
		o.onMonth?.(month, addDays(month, daysInMonth(month) - 1));
	});

	draw();
	o.onMonth?.(month, addDays(month, daysInMonth(month) - 1));
	return {
		el,
		get month() { return month; },
		focus: () => buttonOf(focused)?.focus(),
		mark(dates) {
			let changed = false;
			for (const d of dates) {
				if (marked.has(d)) continue;
				marked.add(d);
				changed = true;
			}
			if (!changed) return;
			const had = el.contains(el.ownerDocument.activeElement);
			draw();
			if (had) buttonOf(focused)?.focus();
		},
	};
}
