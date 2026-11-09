// The place kept per bot through the host's store (spec § The view): the view, and the day in it, come back on the next
// open the same day; on another day only the view does, on today; a lost, broken or foreign value is the first-time place.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keepPlace, readPlace } from '../../src/view/place.ts';

const TODAY = '2026-11-09';
const storeOf = (value: string | null = null) => {
	const map = new Map<string, string>(value === null ? [] : [['place', value]]);
	return { map, store: { get: (k: string) => map.get(k) ?? null, set: (k: string, v: string) => void map.set(k, v) } };
};

describe('the place', () => {
	it('opens the first time on the running journal, at the top', () => {
		assert.deepEqual(readPlace(storeOf().store, TODAY), { view: 'journal', date: null });
	});

	it('comes back the same day as it was kept, the view and the day', () => {
		const { store } = storeOf();
		keepPlace(store, { view: 'day', date: '2026-11-02' }, TODAY);
		assert.deepEqual(readPlace(store, TODAY), { view: 'day', date: '2026-11-02' });
		keepPlace(store, { view: 'journal', date: '2026-10-20' }, TODAY);
		assert.deepEqual(readPlace(store, TODAY), { view: 'journal', date: '2026-10-20' });
	});

	it('on another day keeps only the view, and opens on today', () => {
		const { store } = storeOf();
		keepPlace(store, { view: 'day', date: '2026-11-02' }, '2026-11-08');
		assert.deepEqual(readPlace(store, TODAY), { view: 'day', date: TODAY });
		keepPlace(store, { view: 'journal', date: '2026-10-20' }, '2026-11-08');
		assert.deepEqual(readPlace(store, TODAY), { view: 'journal', date: null });
	});

	it('a value that is lost, broken or not a place is the first-time place, and a store that throws is ignored', () => {
		for (const bad of ['', '{', '[]', '"day"', JSON.stringify({ view: 'week', date: TODAY, on: TODAY }), JSON.stringify({ view: 'day', date: 'soon', on: TODAY })]) {
			const read = readPlace(storeOf(bad).store, TODAY);
			assert.equal(read.date === null || read.date === TODAY, true, bad);
		}
		const throwing = { get: () => { throw new Error('gone'); }, set: () => { throw new Error('full'); } };
		assert.deepEqual(readPlace(throwing, TODAY), { view: 'journal', date: null });
		assert.doesNotThrow(() => keepPlace(throwing, { view: 'day', date: TODAY }, TODAY));
	});
});
