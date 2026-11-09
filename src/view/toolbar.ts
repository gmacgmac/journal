// The bar over the paper, one row at every width: which view (one toggle, the view shown filled in the accent; a press
// switches to the other, and on a wide bar a press on the other's name goes there); in Day, the day shown, the days either
// side and the way back to today; and Add a page (+), which asks which day. Drawn once per mount; `show` brings it in line with the
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
const VIEW_WORDS: Record<View, ViewWord> = { journal: 'journal.view.views.journal', day: 'journal.view.views.day' };
const other = (view: View): View => (view === 'journal' ? 'day' : 'journal');

export function createToolbar(actions: ToolbarActions): Toolbar {
	const option = (view: View) => el('span', [say(VIEW_WORDS[view])], { class: 'view-opt', 'data-view': view });
	const views = el('button', [option('journal'), option('day')], { type: 'button', class: 'views' });
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
	const add = el('button', [el('span', ['+'], { class: 'plus', 'aria-hidden': 'true' }), el('span', [say('journal.view.add.page')], { class: 'add-words' })], {
		type: 'button', 'data-add': '', class: 'add-page', title: say('journal.view.add.page'), 'aria-haspopup': 'dialog',
	});
	const addField = dateField(say('journal.view.add.pick'));
	const bar = el('nav', [views, dayNav, el('span', [add, addField], { class: 'picker-anchor add-anchor' })], {
		class: 'toolbar', 'aria-label': say('journal.view.toolbar.label'),
	});

	let place: Place = { view: 'journal', date: null };
	let today = '';

	bar.addEventListener('click', (e) => {
		const t = (e.target as Element).closest<HTMLElement>('button');
		if (t === null) return;
		if (t === views) {
			// The other view's name goes there; anywhere else on the toggle switches.
			const named = (e.target as Element).closest<HTMLElement>('.view-opt')?.dataset.view;
			return actions.view(named === other(place.view) ? named : other(place.view));
		}
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
			for (const o of views.querySelectorAll<HTMLElement>('.view-opt')) o.classList.toggle('on', o.dataset.view === p.view);
			views.setAttribute('aria-label', say('journal.view.views.switch', { now: say(VIEW_WORDS[p.view]), other: say(VIEW_WORDS[other(p.view)]) }));
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
