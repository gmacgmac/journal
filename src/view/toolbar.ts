// The bar over the paper: which view (the running journal, or one day); in Day, the day shown, the days either side and
// the way back to today; and Add a page, which asks which day. Drawn once per mount; `show` brings it in line with the
// place. It says what the person asked for through `actions` and decides nothing itself.
import { isDate } from '../format/index.ts';
import { shortDate } from './dates.ts';
import { dateField, openPicker } from './picker.ts';
import type { Place, View } from './place.ts';
import { el } from './render.ts';
import { say, type ViewWord } from './words.ts';

export interface ToolbarActions {
	view(view: View): void;
	step(days: -1 | 1): void;
	go(date: string): void;
	add(date: string): void;
}

export interface Toolbar {
	el: HTMLElement;
	show(place: Place, today: string): void;
}

const button = (words: string, attrs: Record<string, string>) => el('button', [words], { type: 'button', ...attrs });
const viewButton = (view: View, words: ViewWord) => button(say(words), { 'data-view': view, 'aria-pressed': 'false' });

export function createToolbar(actions: ToolbarActions): Toolbar {
	const views = el('div', [viewButton('journal', 'journal.view.views.journal'), viewButton('day', 'journal.view.views.day')], {
		class: 'views', role: 'group', 'aria-label': say('journal.view.views.label'),
	});
	const dayLabel = el('span');
	const pick = el('button', [dayLabel], { type: 'button', class: 'day-pick', 'data-nav': 'pick', title: say('journal.view.nav.pick'), 'aria-haspopup': 'dialog' });
	const pickField = dateField(say('journal.view.nav.pick'));
	const toToday = button(say('journal.view.today'), { 'data-nav': 'today' });
	const dayNav = el('div', [
		button('‹', { 'data-nav': 'prev', 'aria-label': say('journal.view.nav.before') }),
		el('span', [pick, pickField], { class: 'picker-anchor' }),
		button('›', { 'data-nav': 'next', 'aria-label': say('journal.view.nav.after') }),
		toToday,
	], { class: 'day-nav' });
	const add = button(say('journal.view.add.page'), { 'data-add': '', class: 'add-page', 'aria-haspopup': 'dialog' });
	const addField = dateField(say('journal.view.add.pick'));
	const bar = el('nav', [views, dayNav, el('span', [add, addField], { class: 'picker-anchor add-anchor' })], {
		class: 'range', 'aria-label': say('journal.view.range.label'),
	});

	let place: Place = { view: 'journal', date: null };
	let today = '';

	bar.addEventListener('click', (e) => {
		const t = (e.target as Element).closest<HTMLElement>('button');
		if (t === null) return;
		const view = t.dataset.view;
		if (view === 'journal' || view === 'day') return actions.view(view);
		switch (t.dataset.nav) {
			case 'prev': return actions.step(-1);
			case 'next': return actions.step(1);
			case 'today': return actions.go(today);
			case 'pick': return openPicker(pickField, { value: place.date ?? today });
		}
		if (t.hasAttribute('data-add')) openPicker(addField, { value: today });
	});
	/** A picked day, once: the field goes back out of sight. */
	const picked = (field: HTMLInputElement, then: (date: string) => void) => field.addEventListener('change', () => {
		field.classList.remove('shown');
		if (isDate(field.value)) then(field.value);
	});
	picked(pickField, (date) => actions.go(date));
	picked(addField, (date) => actions.add(date));

	return {
		el: bar,
		show(p, t) {
			place = p;
			today = t;
			for (const b of views.querySelectorAll<HTMLElement>('button')) b.setAttribute('aria-pressed', String(b.dataset.view === p.view));
			dayNav.hidden = p.view !== 'day';
			const date = p.date ?? t;
			dayLabel.textContent = date === t ? say('journal.view.today') : shortDate(date);
			// Kept in its place when it is not needed, so nothing in the bar moves as the days change.
			toToday.classList.toggle('away', date === t);
			if (date === t) toToday.setAttribute('aria-hidden', 'true');
			else toToday.removeAttribute('aria-hidden');
			toToday.tabIndex = date === t ? -1 : 0;
		},
	};
}
