// The view's own range math, on top of the day file's dates (`src/format/`).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, daysBetween } from '../../src/format/index.ts';
import { dayMonth, shift, shortDate, snippet, SNIPPET, startOfWeek, WEEK_START, weekOf } from '../../src/view/dates.ts';

describe('view dates and ranges', () => {
	it('names a day short, the way a chip shows it', () => {
		// 28 September 2026 is a Monday.
		assert.equal(shortDate('2026-09-28'), 'Mon 28 Sep');
		assert.equal(dayMonth('2026-09-28'), '28 Sep');
	});

	it('cuts a snippet to its length, without Markdown marks', () => {
		assert.equal(snippet('## 21:30 · **Bold** _words_'), '21:30 · Bold words');
		const long = 'word '.repeat(40);
		const cut = snippet(long);
		assert.equal(cut.length, SNIPPET);
		assert.ok(cut.endsWith('…'));
	});

	it('starts a week on Monday, and on another day when asked', () => {
		assert.equal(WEEK_START, 1);
		// Thursday 1 October 2026.
		assert.equal(startOfWeek('2026-10-01', 1), '2026-09-28');
		assert.equal(startOfWeek('2026-10-01', 0), '2026-09-27');
		assert.equal(startOfWeek('2026-09-28', 1), '2026-09-28');
		assert.deepEqual(weekOf('2026-10-01'), { from: '2026-09-28', to: addDays('2026-09-28', 6) });
		assert.deepEqual(weekOf('2026-10-04'), weekOf('2026-09-28'), 'Sunday ends the week Monday starts');
	});

	it('moves a range by its own length', () => {
		const week = { from: '2026-09-28', to: '2026-10-04' };
		const n = daysBetween(week.from, week.to);
		assert.deepEqual(shift(week, 1), { from: addDays(week.from, n), to: addDays(week.to, n) });
		assert.deepEqual(shift(week, -1), { from: addDays(week.from, -n), to: addDays(week.to, -n) });
		assert.deepEqual(shift(shift(week, 1), -1), week);
	});
});
