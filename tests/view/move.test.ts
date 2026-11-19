// Moving an entry (GM, 2026-11-19): which places keep the timed entries in time order, and the one edit that moves it.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { blocksOf, dateHeading, keyedBlocks } from '../../src/format/index.ts';
import { plan } from '../../src/store/index.ts';
import { entriesOfDay, moveEdit, slotsFor } from '../../src/view/move.ts';

const DATE = '2026-11-08';
const day = (...parts: string[]) => `${dateHeading(DATE)}\n\n${parts.join('\n\n')}\n`;
const entriesOf = (text: string) => entriesOfDay(keyedBlocks(text).slice(1));
const applied = (text: string, from: number, slot: number) => {
	const e = moveEdit(DATE, entriesOf(text), from, slot);
	assert.ok(e !== null);
	const r = plan(DATE, text, e);
	assert.ok(r.ok, JSON.stringify(r));
	return r.text;
};

const TEXT = day('## Weekend', 'Leaving early.', '- sleep in\n- the market', '## 16:40', 'Tea.', '## Notes', 'A note.', '## 17:09', 'oh toodles');

describe('moving an entry', () => {
	it('reads a day as entries, each heading with the writing under it', () => {
		const entries = entriesOf(TEXT);
		assert.deepEqual(entries.map((e) => [e.time, e.blocks.length]), [[null, 3], ['16:40', 2], [null, 2], ['17:09', 2]]);
	});

	it('an entry with no time may go anywhere; a timed one only between its timed neighbours', () => {
		assert.deepEqual(slotsFor(entriesOf(TEXT), 0), [0, 1, 2, 3, 4]);
		assert.deepEqual(slotsFor(entriesOf(TEXT), 1), [0, 1, 2, 3], '16:40 never after 17:09');
		assert.deepEqual(slotsFor(entriesOf(TEXT), 3), [2, 3, 4], '17:09 never before 16:40');
	});

	it('moves an entry down, writing and all, as one edit that reads back', () => {
		assert.equal(applied(TEXT, 0, 4), day('## 16:40', 'Tea.', '## Notes', 'A note.', '## 17:09', 'oh toodles', '## Weekend', 'Leaving early.', '- sleep in\n- the market'));
	});

	it('moves an entry up', () => {
		assert.equal(applied(TEXT, 2, 0), day('## Notes', 'A note.', '## Weekend', 'Leaving early.', '- sleep in\n- the market', '## 16:40', 'Tea.', '## 17:09', 'oh toodles'));
	});

	it('the edit touches only the entries between the two places, and one undo puts them back', () => {
		const e = moveEdit(DATE, entriesOf(TEXT), 2, 1)!;
		assert.ok(e.before.startsWith('## 16:40') && e.before.endsWith('A note.'));
		const r = plan(DATE, TEXT, e);
		assert.ok(r.ok);
		const back = { op: 'range' as const, date: DATE, start: e.start, end: e.start + e.after.length, before: e.after, after: e.before };
		const undone = plan(DATE, r.text, back);
		assert.ok(undone.ok && undone.text === TEXT);
	});

	it('nothing to save where it already is, nor where the entries are not a blank line apart', () => {
		assert.equal(moveEdit(DATE, entriesOf(TEXT), 1, 1), null);
		assert.equal(moveEdit(DATE, entriesOf(TEXT), 1, 2), null);
		const odd = TEXT.replace('Tea.\n\n## Notes', 'Tea.\n\n\n## Notes');
		assert.equal(blocksOf(odd).length, blocksOf(TEXT).length);
		assert.equal(moveEdit(DATE, entriesOf(odd), 0, 4), null);
	});
});
