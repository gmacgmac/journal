import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	addDays, entryHeading, localToday, shift, shortDate, snippet, SNIPPET, spanOf, startOfWeek, weekOf, weekStartOf,
} from '../../src/view/dates.ts';

describe('view dates and ranges', () => {
	it('adds days across a month and a year', () => {
		assert.equal(addDays('2026-09-30', 1), '2026-10-01');
		assert.equal(addDays('2026-12-31', 1), '2027-01-01');
		assert.equal(addDays('2026-03-01', -1), '2026-02-28');
	});

	it('names a day short, the way a chip shows it', () => {
		// 28 September 2026 is a Monday (the sample week starts there).
		assert.equal(shortDate('2026-09-28'), 'Mon 28 Sep');
	});

	it('cuts a snippet to its length, without Markdown marks', () => {
		assert.equal(snippet('## 21:30 · **Bold** _words_'), '21:30 · Bold words');
		const long = 'word '.repeat(40);
		const cut = snippet(long);
		assert.equal(cut.length, SNIPPET);
		assert.ok(cut.endsWith('…'));
	});

	it('counts a range with both ends included', () => {
		assert.equal(spanOf('2026-09-28', '2026-10-04'), 7);
		assert.equal(spanOf('2026-10-01', '2026-10-01'), 1);
	});

	it('starts a week on Monday by default and on Sunday when set', () => {
		assert.equal(weekStartOf(undefined), 1);
		assert.equal(weekStartOf('monday'), 1);
		assert.equal(weekStartOf('sunday'), 0);
		// Thursday 1 October 2026.
		assert.equal(startOfWeek('2026-10-01', 1), '2026-09-28');
		assert.equal(startOfWeek('2026-10-01', 0), '2026-09-27');
		assert.equal(startOfWeek('2026-09-28', 1), '2026-09-28');
		assert.deepEqual(weekOf('2026-10-01', 1), { from: '2026-09-28', to: addDays('2026-09-28', 6) });
	});

	it('moves a range by its own length', () => {
		const week = { from: '2026-09-28', to: '2026-10-04' };
		const n = spanOf(week.from, week.to);
		assert.deepEqual(shift(week, 1), { from: addDays(week.from, n), to: addDays(week.to, n) });
		assert.deepEqual(shift(week, -1), { from: addDays(week.from, -n), to: addDays(week.to, -n) });
		assert.deepEqual(shift(shift(week, 1), -1), week);
	});

	it('reads today in the local time zone', () => {
		const now = new Date(2026, 9, 1, 23, 30);
		assert.equal(localToday(now), '2026-10-01');
	});

	it('writes an entry heading with and without a title', () => {
		assert.equal(entryHeading('09:05'), '## 09:05');
		assert.equal(entryHeading('21:30', 'Evening'), '## 21:30 · Evening');
	});
});
