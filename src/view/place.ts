// Where the person was: the view (the running journal, or one day) and, within it, the day they were on. Kept per bot on
// this device through the host's `store` (the contract's viewer conveniences, which may lose anything), so closing and
// opening the pane, or the app, comes back to the same place. A new day starts on today: the place is kept with the date
// it was kept on, and a place from another day keeps only its view.
import { isDate } from '../format/index.ts';
import type { PluginStore } from '../vendor/plugin-host/plugin-host.ts';

export type View = 'journal' | 'day';

/**
 * `day`: the date shown. `journal`: the day at the top of the scroll, or null for the top (today). The journal opens on
 * today the first time.
 */
export type Place = { view: 'journal'; date: string | null } | { view: 'day'; date: string };

const KEY = 'place';

/** The place kept for this bot, as it applies `today`. */
export function readPlace(store: PluginStore, today: string): Place {
	let kept: Record<string, unknown> = {};
	try {
		const raw: unknown = JSON.parse(store.get(KEY) || '{}');
		if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) kept = raw as Record<string, unknown>;
	} catch {
		// Lost or unreadable: the first-time place.
	}
	const date = kept.on === today && isDate(kept.date) ? kept.date : null;
	return kept.view === 'day' ? { view: 'day', date: date ?? today } : { view: 'journal', date };
}

export function keepPlace(store: PluginStore, place: Place, today: string): void {
	try {
		store.set(KEY, JSON.stringify({ ...place, on: today }));
	} catch {
		// The store may refuse; the place is a convenience.
	}
}
