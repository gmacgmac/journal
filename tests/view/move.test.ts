// Moving an entry (GM, 2026-11-19): the edit the view sends. Which places are allowed and how the bytes move are tested with
// the rules themselves (`tests/format.test.ts`, `tests/store.test.ts`); here, that the view names the entries right.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateHeading, entrySpans, keyedBlocks } from '../../src/format/index.ts';
import { entryName, isStill, moveEditOf } from '../../src/view/move.ts';

const DATE = '2026-11-08';
const day = (...parts: string[]) => `${dateHeading(DATE)}\n\n${parts.join('\n\n')}\n`;
const spans = (text: string) => entrySpans(keyedBlocks(text).slice(1));

const TEXT = day('## Weekend', 'Leaving early.', '## 16:40', 'Tea.', '## Notes', 'A note.', '## 17:09', 'oh toodles');

describe('the edit that moves an entry', () => {
	it('names the entry and the one it goes in front of, by id', () => {
		const s = spans(TEXT);
		assert.deepEqual(moveEditOf(DATE, s, 0, 3), { op: 'move', date: DATE, entry: s[0]!.id, blocks: s[0]!.blocks.map((b) => b.key), before: s[3]!.id });
		assert.deepEqual(moveEditOf(DATE, s, 2, 0), { op: 'move', date: DATE, entry: s[2]!.id, blocks: s[2]!.blocks.map((b) => b.key), before: s[0]!.id });
	});

	it('a drop past the last entry is the end of the day', () => {
		const s = spans(TEXT);
		assert.deepEqual(moveEditOf(DATE, s, 0, 4), { op: 'move', date: DATE, entry: s[0]!.id, blocks: s[0]!.blocks.map((b) => b.key), before: null });
	});

	it('nothing to send where the entry already is, or for a place that is not one', () => {
		const s = spans(TEXT);
		assert.equal(moveEditOf(DATE, s, 1, 1), null);
		assert.equal(moveEditOf(DATE, s, 1, 2), null);
		assert.equal(moveEditOf(DATE, s, 1, 9), null);
		assert.equal(moveEditOf(DATE, s, 9, 0), null);
		assert.ok(isStill(1, 1) && isStill(1, 2) && !isStill(1, 3));
	});

	it('an entry is said by its title, else its time', () => {
		assert.deepEqual(spans(TEXT).map(entryName), ['Weekend', '16:40', 'Notes', '17:09']);
	});
});
