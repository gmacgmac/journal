// The view's own date names and ranges, on top of the day file's dates (`src/format/`).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, daysBetween } from '../../src/format/index.ts';
import { dayMonth, RECENT_DAYS, recentDays, shortDate, snippet, SNIPPET } from '../../src/view/dates.ts';

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

	it('the recent days are the last seven, ending on today, across a month and a year', () => {
		assert.equal(RECENT_DAYS, 7);
		for (const today of ['2026-11-09', '2026-11-03', '2027-01-02']) {
			const r = recentDays(today);
			assert.equal(r.to, today);
			assert.equal(r.from, addDays(today, -(RECENT_DAYS - 1)));
			assert.equal(daysBetween(r.from, r.to), RECENT_DAYS);
		}
		assert.deepEqual(recentDays('2026-11-09', 1), { from: '2026-11-09', to: '2026-11-09' });
	});
});
