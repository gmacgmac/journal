// The proof's store, edit and undo tests (nclite prototypes/journal-paper/store.test.ts), carried over, and the spec's
// § The data: a day that breaks the rules, a day too big, an atomic write, untouched bytes over every sample day.
import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { MAX_DAY_BLOCKS, MAX_DAY_BYTES, MAX_DAY_JSON_BYTES, blocksOf, dateHeading, dayPath, entriesOf, entrySpansOf, keyedBlocks as keyedBlocksOf } from '../src/format/index.ts';
import type { Edit } from '../src/seam-types.ts';
import { applyEdit, dayFile, plan, readDayFile, undoOf, version, writeDay, type Plan } from '../src/store/index.ts';
import { DAYS, sampleDays, scratch } from './fixtures/days.ts';

const DATE = '2026-10-01';
/** The keys of entry `id`'s blocks in `text`: what the view sends as the entry it saw. */
const seenKeys = (text: string, id: string): string[] => entrySpansOf(text).find((e) => e.id === id)?.blocks.map((b) => b.key) ?? ['gone-0'];
const read = (dir: string, date = DATE): string => readFileSync(dayFile(dir, date), 'utf8');

function replaceOf(dir: string, index: number, after: string, date = DATE): Extract<Edit, { op: 'replace' }> {
	const b = blocksOf(read(dir, date))[index]!;
	return { op: 'replace', date, start: b.start, end: b.end, before: b.text, after };
}

const status = (p: Plan): number | 'ok' => (p.ok ? 'ok' : p.status);
const code = (p: Plan): string => (p.ok ? 'ok' : p.code);
const textOf = (p: Plan): string => {
	assert.ok(p.ok, JSON.stringify(p));
	return p.text;
};

test('a save changes only its block’s range; every byte outside it is the same', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const paragraphs = blocksOf(read(dir)).map((b, i) => [b, i] as const).filter(([b]) => /^[A-Z]/.test(b.text));
	for (const [, index] of paragraphs) {
		const text = read(dir);
		const e = replaceOf(dir, index, 'A corrected sentence, nothing more.');
		assert.ok(applyEdit(dir, e).ok);
		const now = read(dir);
		assert.equal(now.slice(0, e.start), text.slice(0, e.start));
		assert.equal(now.slice(e.start + e.after.length), text.slice(e.end));
	}
});

test('a write leaves every untouched block’s bytes as they were, over every sample day', () => {
	for (const [date, text] of sampleDays()) {
		const blocks = blocksOf(text);
		blocks.forEach((b, i) => {
			if (i === 0 || b.kind === 'heading') return;
			const after = textOf(plan(date, text, { op: 'replace', date, start: b.start, end: b.end, before: b.text, after: 'Changed.' }));
			const others = blocksOf(after).filter((x) => x.text !== 'Changed.').map((x) => x.text);
			assert.deepEqual(others, blocks.filter((_, j) => j !== i).map((x) => x.text), `${date} block ${i}`);
			assert.equal(after, text.slice(0, b.start) + 'Changed.' + text.slice(b.end), `${date} block ${i}`);
		});
	}
});

test('a stale “before” is refused with the current text, and the file is untouched', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const e = replaceOf(dir, 2, 'My edit.');
	const botText = read(dir).replace(e.before, `${e.before} The bot added this.`);
	writeFileSync(dayFile(dir, DATE), botText);
	const result = applyEdit(dir, e);
	assert.ok(!result.ok);
	assert.equal(result.status, 409);
	assert.equal(read(dir), botText);
	assert.deepEqual(result.file, { state: 'text', text: botText });
});

test('a block whose bytes still match but which grew on disk is refused too', () => {
	const e = replaceOf(DAYS, 2, 'My edit.');
	const text = read(DAYS);
	assert.equal(status(plan(DATE, text.slice(0, e.end) + '\nand a line the bot added' + text.slice(e.end), e)), 409);
});

test('an open block survives a write earlier in the day: its text found once, the edit moves to it', () => {
	const text = read(DAYS);
	const e = replaceOf(DAYS, 5, 'Moved and saved.');
	const insert: Edit = { op: 'insert', date: DATE, start: e.start, end: e.end, before: e.before, text: 'Added after.' };
	const earlier = text.replace('## 06:50\n\n', '## 06:50\n\nThe bot wrote this first.\n\n');
	const replaced = textOf(plan(DATE, earlier, e));
	assert.equal(replaced, earlier.replace(e.before, 'Moved and saved.'));
	assert.equal(textOf(plan(DATE, earlier, insert)), earlier.replace(e.before, `${e.before}\n\nAdded after.`));
});

test('a before found twice, or not at all, is refused changed', () => {
	const text = read(DAYS);
	const e = replaceOf(DAYS, 5, 'Mine.');
	const twice = text.replace('## 13:15', `## 06:55\n\n${e.before}\n\n## 13:15`);
	assert.equal(code(plan(DATE, twice, e)), 'changed');
	assert.equal(code(plan(DATE, text.replace(e.before, 'Someone else’s.'), e)), 'changed');
});

test('writing can’t add a heading, but may become two paragraphs or a list', () => {
	const text = read(DAYS);
	assert.equal(code(plan(DATE, text, replaceOf(DAYS, 2, 'Still a paragraph.\n\n## 23:00 · Sneaked in'))), 'heading');
	assert.equal(status(plan(DATE, text, replaceOf(DAYS, 2, 'One paragraph\n\nbecomes two'))), 'ok');
	assert.equal(status(plan(DATE, text, replaceOf(DAYS, 2, '- [ ] now a to-do'))), 'ok');
});

test('an entry heading stays one entry heading at a free time; the date heading cannot be edited', () => {
	const text = read(DAYS);
	assert.equal(status(plan(DATE, text, replaceOf(DAYS, 1, '## 07:05 · Earlier than I thought'))), 'ok');
	assert.equal(code(plan(DATE, text, replaceOf(DAYS, 1, 'not a heading'))), 'heading');
	assert.equal(code(plan(DATE, text, replaceOf(DAYS, 1, '## 25:99'))), 'heading');
	assert.equal(code(plan(DATE, text, replaceOf(DAYS, 1, '## 13:15'))), 'entry-exists');
	assert.equal(code(plan(DATE, text, replaceOf(DAYS, 0, '# Friday 2 October 2026'))), 'date-heading');
});

test('deleting a block removes it and the blank line after it, nothing more', () => {
	const e = replaceOf(DAYS, 2, '');
	const text = read(DAYS);
	assert.equal(textOf(plan(DATE, text, e)), text.slice(0, e.start) + text.slice(e.end + 2));
});

test('deleting the last block takes the blank line before it instead', () => {
	const e = replaceOf(DAYS, blocksOf(read(DAYS)).length - 1, '');
	const text = read(DAYS);
	assert.equal(textOf(plan(DATE, text, e)), text.slice(0, e.start - 2) + text.slice(e.end));
});

test('insert adds writing straight after its block, and never a heading', () => {
	const text = read(DAYS);
	const b = blocksOf(text)[2]!;
	const at = { date: DATE, start: b.start, end: b.end, before: b.text };
	assert.equal(textOf(plan(DATE, text, { op: 'insert', ...at, text: 'A new paragraph.' })), `${text.slice(0, b.end)}\n\nA new paragraph.${text.slice(b.end)}`);
	assert.equal(code(plan(DATE, text, { op: 'insert', ...at, text: '## 23:00' })), 'heading');
	assert.equal(status(plan(DATE, text.replace(b.text, `${b.text} more`), { op: 'insert', ...at, text: 'x' })), 409);
});

test('a new entry lands in time order, makes the day’s page when there is none, and never takes a time twice', () => {
	const text = read(DAYS);
	const entry = (time: string, t: string | null = null): Edit => ({ op: 'entry', date: DATE, time, title: t, text: 'Written by hand.' });
	const times = (s: string): string[] => blocksOf(s).map((b) => b.text).filter((x) => x.startsWith('## ')).map((x) => x.slice(3, 8));
	for (const time of ['05:00', '13:16', '17:00', '23:59']) assert.deepEqual(times(textOf(plan(DATE, text, entry(time, 'A title')))), [...times(text), time].sort(), time);
	assert.equal(code(plan(DATE, text, entry('13:15'))), 'entry-exists');
	assert.equal(code(plan(DATE, text, entry('9:00'))), 'unreadable');
	assert.ok(textOf(plan('2026-10-03', null, { ...entry('09:00'), date: '2026-10-03' })).startsWith(dateHeading('2026-10-03')));
});

test('every saved edit comes back with an undo that restores the file exactly', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const original = read(dir);
	const b = blocksOf(original)[2]!;
	const edits: Edit[] = [
		replaceOf(dir, 2, 'Rewritten **completely**.'),
		{ op: 'insert', date: DATE, start: b.start, end: b.end, before: b.text, text: '- [ ] a to-do' },
		{ op: 'entry', date: DATE, time: '12:00', title: 'Lunch', text: 'Soup.' },
		replaceOf(dir, 2, ''),
	];
	for (const e of edits) {
		const result = applyEdit(dir, e);
		assert.ok(result.ok, JSON.stringify(result));
		assert.ok(applyEdit(dir, result.undo).ok);
		assert.equal(read(dir), original, e.op);
	}
});

test('an undo is refused once the bytes it would put back over have changed, and never moves', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const result = applyEdit(dir, replaceOf(dir, 2, 'Mine.'));
	assert.ok(result.ok);
	const saved = read(dir);
	writeFileSync(dayFile(dir, DATE), saved.replace('Mine.', 'Mine, then the bot’s.'));
	const undo = applyEdit(dir, result.undo);
	assert.equal(!undo.ok && undo.status, 409);
	const above = saved.replace('## 06:50\n\n', '## 06:50\n\nAbove.\n\n');
	assert.equal(code(plan(DATE, above, result.undo)), 'changed');
});

test('a new entry on a missing day makes its page; its undo leaves a bare page', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const date = '2026-10-03';
	assert.ok(!existsSync(join(dir, dayPath(date))));
	const result = applyEdit(dir, { op: 'entry', date, time: '10:00', title: null, text: 'A quiet Saturday.' });
	assert.ok(result.ok);
	assert.ok(applyEdit(dir, result.undo).ok);
	assert.equal(read(dir, date), `${dateHeading(date)}\n`);
});

test('a day that breaks the rules is read with its problems and refused for every write', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const broken = `${read(dir)}\n<div>by hand</div>\n`;
	writeFileSync(dayFile(dir, DATE), broken);
	assert.deepEqual(readDayFile(dir, DATE), { state: 'text', text: broken });
	const b = blocksOf(broken)[2]!;
	const edits: Edit[] = [
		{ op: 'replace', date: DATE, start: b.start, end: b.end, before: b.text, after: 'x' },
		{ op: 'insert', date: DATE, start: b.start, end: b.end, before: b.text, text: 'x' },
		{ op: 'entry', date: DATE, time: '23:00', title: null, text: 'x' },
		{ op: 'range', date: DATE, start: 0, end: 1, before: '#', after: '#' },
	];
	for (const e of edits) {
		const r = applyEdit(dir, e);
		assert.equal(!r.ok && r.code, 'malformed', e.op);
	}
	assert.equal(read(dir), broken);
});

test('a day over MAX_DAY_BYTES is too-big and not read, and no write makes one', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const big = `${dateHeading(DATE)}\n\n## 09:00\n\n${'x'.repeat(MAX_DAY_BYTES)}\n`;
	writeFileSync(dayFile(dir, DATE), big);
	assert.deepEqual(readDayFile(dir, DATE), { state: 'too-big' });
	const r = applyEdit(dir, { op: 'entry', date: DATE, time: '23:00', title: null, text: 'x' });
	assert.equal(!r.ok && r.code, 'too-big');
	const grow = applyEdit(dir, { op: 'entry', date: '2026-10-03', time: '09:00', title: null, text: 'y'.repeat(MAX_DAY_BYTES) });
	assert.equal(!grow.ok && grow.code, 'too-big');
	assert.equal(readDayFile(dir, '2026-10-03').state, 'none');
});

test('a day over MAX_DAY_BLOCKS blocks, or whose text as JSON is over MAX_DAY_JSON_BYTES, is too-big, and no write makes one', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const head = `${dateHeading(DATE)}\n\n## 09:00\n\n`;
	const many = `${head}${Array.from({ length: MAX_DAY_BLOCKS - 1 }, (_, i) => `p${i}`).join('\n\n')}\n`;
	const escaped = `${head}${'\u0001'.repeat(Math.ceil(MAX_DAY_JSON_BYTES / 6))}\n`;
	for (const text of [many, escaped]) {
		assert.ok(Buffer.byteLength(text) <= MAX_DAY_BYTES, 'legal by size');
		writeFileSync(dayFile(dir, DATE), text);
		assert.deepEqual(readDayFile(dir, DATE), { state: 'too-big' });
		const r = applyEdit(dir, { op: 'entry', date: DATE, time: '23:00', title: null, text: 'x' });
		assert.equal(!r.ok && r.code, 'too-big');
		assert.equal(read(dir), text);
	}
	// One block short of the limit reads; a write that would add the one too many is refused.
	const full = `${head}${Array.from({ length: MAX_DAY_BLOCKS - 2 }, (_, i) => `p${i}`).join('\n\n')}\n`;
	writeFileSync(dayFile(dir, DATE), full);
	assert.equal(readDayFile(dir, DATE).state, 'text');
	const last = blocksOf(full).at(-1)!;
	const grow = applyEdit(dir, { op: 'insert', date: DATE, start: last.start, end: last.end, before: last.text, text: 'one more' });
	assert.equal(!grow.ok && grow.code, 'too-big');
	assert.equal(read(dir), full);
});

test('a write is atomic: a reader sees the old file or the new one, and no temp file is left', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const old = read(dir);
	const next = `${old}\n## 23:30\n\nLate.\n`.replace('\n\n## 23:30', '## 23:30');
	writeDay(dir, DATE, next);
	assert.equal(read(dir), next);
	assert.deepEqual(readdirSync(join(dir, '2026', '10')).filter((f) => f.endsWith('.tmp')), []);
	// The write is a rename: a reader holding the old file keeps reading the old bytes.
	const fd = openSync(dayFile(dir, DATE), 'r');
	writeDay(dir, DATE, old);
	const held = readFileSync(fd, 'utf8');
	closeSync(fd);
	assert.equal(held, next);
	assert.equal(read(dir), old);
});

test('an edit writes only under the data folder: a bad date, a link, or a folder leading out is refused', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	const outside = scratch(true);
	t.after(outside.done);
	assert.throws(() => dayFile(dir, '../2026-10-01'));
	writeFileSync(join(outside.dir, 'secret.md'), `${dateHeading('2026-10-05')}\n`);
	symlinkSync(join(outside.dir, 'secret.md'), join(dir, dayPath('2026-10-03')));
	assert.deepEqual(readDayFile(dir, '2026-10-03'), { state: 'odd' });
	const r = applyEdit(dir, { op: 'entry', date: '2026-10-03', time: '09:00', title: null, text: 'x' });
	assert.equal(!r.ok && r.code, 'malformed');
	mkdirSync(join(dir, '2026'), { recursive: true });
	symlinkSync(outside.dir, join(dir, '2026', '11'));
	assert.deepEqual(readDayFile(dir, '2026-11-05'), { state: 'none' });
	assert.throws(() => applyEdit(dir, { op: 'entry', date: '2026-11-05', time: '09:00', title: null, text: 'x' }));
	assert.deepEqual(readdirSync(outside.dir), ['secret.md']);
});

test('a heading given a new time moves its entry, writing and all, into time order (GM, 2026-11-19)', () => {
	const date = '2026-11-07';
	const text = `${dateHeading(date)}\n\n## 08:15 · Book\n\nRead.\n\nMore.\n\n## 09:00\n\nNine.\n\n## 21:00\n\nBed.\n`;
	const head = (t: string) => blocksOf(text).find((b) => b.text === t)!;
	const retime = (from: string, to: string) => {
		const b = head(from);
		return textOf(plan(date, text, { op: 'replace', date, start: b.start, end: b.end, before: b.text, after: to }));
	};
	// Later than the last: to the end.
	assert.equal(retime('## 08:15 · Book', '## 22:00 · Book'), `${dateHeading(date)}\n\n## 09:00\n\nNine.\n\n## 21:00\n\nBed.\n\n## 22:00 · Book\n\nRead.\n\nMore.\n`);
	// Between two others: there.
	assert.equal(retime('## 21:00', '## 08:30'), `${dateHeading(date)}\n\n## 08:15 · Book\n\nRead.\n\nMore.\n\n## 08:30\n\nBed.\n\n## 09:00\n\nNine.\n`);
	// Still in order: where it was.
	assert.equal(retime('## 09:00', '## 10:01'), text.replace('## 09:00', '## 10:01'));
	// Taken off its time: where it was.
	assert.equal(retime('## 09:00', '## Nine'), text.replace('## 09:00', '## Nine'));
});

test('move, remove and clear name an entry or a day, and the engine does the bytes (GM, 2026-11-19)', () => {
	const date = '2026-11-08';
	const day = (...parts: string[]) => `${dateHeading(date)}\n\n${parts.join('\n\n')}\n`;
	const text = day('## Weekend', 'Leaving early.', '## 16:40', 'Tea.', '- one\n- two', '## Notes', 'A note.', '## 17:09', 'oh toodles');
	const [weekend, tea, notes, late] = entriesOf(text).map((e) => e.id) as [string, string, string, string];
	const move = (t: string, entry: string, before: string | null) => plan(date, t, { op: 'move', date, entry, blocks: seenKeys(t, entry), before });
	const remove = (t: string, entry: string) => plan(date, t, { op: 'remove', date, entry, blocks: seenKeys(t, entry) });

	// Moved to the end, writing and all; an untimed entry between timed ones.
	assert.equal(textOf(move(text, weekend, null)), day('## 16:40', 'Tea.', '- one\n- two', '## Notes', 'A note.', '## 17:09', 'oh toodles', '## Weekend', 'Leaving early.'));
	assert.equal(textOf(move(text, notes, weekend)), day('## Notes', 'A note.', '## Weekend', 'Leaving early.', '## 16:40', 'Tea.', '- one\n- two', '## 17:09', 'oh toodles'));
	// To where it already is: the text as it was, to the byte.
	assert.equal(textOf(move(text, tea, tea)), text);
	assert.equal(textOf(move(text, tea, notes)), text);
	assert.equal(textOf(move(text, late, null)), text);
	// A timed entry keeps its place in time order.
	for (const [entry, before] of [[tea, null], [late, weekend], [late, tea]] as const) {
		const r = move(text, entry, before);
		assert.deepEqual([status(r), code(r)], [422, 'order']);
		assert.ok(!r.ok && r.say === 'journal.problem.entry-order');
	}
	// An entry that is not there, or a place that is not there, is refused changed.
	for (const r of [move(text, 'nope-0', null), move(text, tea, 'nope-0'), remove(text, 'nope-0')]) assert.deepEqual([status(r), code(r)], [409, 'changed']);

	assert.equal(textOf(remove(text, tea)), day('## Weekend', 'Leaving early.', '## Notes', 'A note.', '## 17:09', 'oh toodles'));
	assert.equal(textOf(remove(day('## Only', 'Writing.'), entriesOf(day('## Only', 'Writing.'))[0]!.id)), `${dateHeading(date)}\n`);

	// Clear: the day as it was read, its date line left.
	assert.equal(textOf(plan(date, text, { op: 'clear', date, version: version(text) })), `${dateHeading(date)}\n`);
	assert.deepEqual([status(plan(date, text, { op: 'clear', date, version: version(`${text}x`) })), code(plan(date, text, { op: 'clear', date, version: 'x' }))], [409, 'changed']);
	// No page to move in, or remove from, or clear.
	for (const e of [{ op: 'move', date, entry: tea, blocks: [tea], before: null }, { op: 'remove', date, entry: tea, blocks: [tea] }, { op: 'clear', date, version: 'x' }] as Edit[]) {
		assert.deepEqual([status(plan(date, null, e)), code(plan(date, null, e))], [409, 'changed']);
	}
});

test('a hand-spaced file is moved and removed all the same, and each edit undoes by a range', () => {
	const date = '2026-11-08';
	const text = `${dateHeading(date)}\n\n\n## Weekend\n\n\nLeaving early.\n\n\n\n## Notes\n\nA note.\n\n\n## 16:40\n\nTea.\n`;
	assert.equal(blocksOf(text).length, 7);
	const [weekend, notes, tea] = entriesOf(text).map((e) => e.id) as [string, string, string];
	const edits: Edit[] = [
		{ op: 'move', date, entry: weekend, blocks: seenKeys(text, weekend), before: null },
		{ op: 'move', date, entry: tea, blocks: seenKeys(text, tea), before: weekend },
		{ op: 'remove', date, entry: notes, blocks: seenKeys(text, notes) },
		{ op: 'clear', date, version: version(text) },
	];
	for (const e of edits) {
		const after = textOf(plan(date, text, e));
		assert.ok(after.endsWith('\n') && !after.endsWith('\n\n'), e.op);
		assert.ok(!after.includes('\n\n\n\n'), `${e.op}: the gap between entries is one blank line`);
		// Undo: a range planned on the new text puts the old bytes back.
		assert.equal(textOf(plan(date, after, undoOf(date, text, after))), text, e.op);
	}
	assert.equal(textOf(plan(date, text, edits[0]!)), `${dateHeading(date)}\n\n## Notes\n\nA note.\n\n## 16:40\n\nTea.\n\n## Weekend\n\n\nLeaving early.\n`);
});

test('move, remove and clear are applied through the store with an undo that restores the file', (t) => {
	const { dir, done } = scratch();
	t.after(done);
	// A day whose entries have no time, so any may move.
	const before = `${dateHeading(DATE)}\n\n## One\n\nFirst.\n\n## Two\n\nSecond.\n\n## Three\n\nThird.\n`;
	writeDay(dir, DATE, before);
	const ids = entriesOf(before).map((e) => e.id);
	for (const e of [
		{ op: 'move', date: DATE, entry: ids[0]!, blocks: seenKeys(before, ids[0]!), before: null },
		{ op: 'remove', date: DATE, entry: ids[1]!, blocks: seenKeys(before, ids[1]!) },
		{ op: 'clear', date: DATE, version: version(before) },
	] as Edit[]) {
		const done = applyEdit(dir, e);
		assert.ok(done.ok, e.op);
		assert.notEqual(read(dir), before);
		assert.ok(applyEdit(dir, done.undo).ok);
		assert.equal(read(dir), before, e.op);
	}
});

test('join: two paragraphs side by side, named by key, become the one given, however they were spaced (GM, 2026-11-19)', () => {
	const date = '2026-11-08';
	const keyOf = (t: string, words: string) => keyedBlocksOf(t).find((b) => b.text === words)!.key;
	const join = (t: string, first: string, second: string, text: string) => plan(date, t, { op: 'join', date, first, second, text });
	const text = `${dateHeading(date)}\n\n## Notes\n\nOne.\n\nTwo.\n\n- a list\n`;
	const one = keyOf(text, 'One.');
	const two = keyOf(text, 'Two.');
	assert.equal(textOf(join(text, one, two, 'One.Two, changed.')), `${dateHeading(date)}\n\n## Notes\n\nOne.Two, changed.\n\n- a list\n`);
	// A pair spaced by hand joins all the same: the engine finds the bytes.
	const spaced = text.replace('One.\n\nTwo.', 'One.\n\n\n\nTwo.');
	assert.equal(textOf(join(spaced, one, two, 'One.Two.')), `${dateHeading(date)}\n\n## Notes\n\nOne.Two.\n\n- a list\n`);
	// Refused: a key gone, a pair not side by side, a block not a paragraph, writing that is not one paragraph.
	assert.equal(status(join(text, 'deadbeef-0', two, 'x')), 409);
	assert.equal(status(join(text, two, one, 'x')), 409);
	assert.deepEqual([status(join(text, two, keyOf(text, '- a list'), 'Two. a list')), code(join(text, two, keyOf(text, '- a list'), 'Two. a list'))], [422, 'join']);
	assert.deepEqual([status(join(text, one, two, 'One.\n\nTwo.')), code(join(text, one, two, 'One.\n\nTwo.'))], [422, 'join']);
	// Undone by the range it answers with.
	const after = textOf(join(spaced, one, two, 'One.Two.'));
	const undo = undoOf(date, spaced, after);
	assert.equal(textOf(plan(date, after, undo)), spaced);
});

test('remove and move name the entry as it was seen: one the file has added to since, or another under the same heading, is refused (Fable review, 2026-11-19)', () => {
	const date = '2026-11-08';
	const day = (...parts: string[]) => `${dateHeading(date)}\n\n${parts.join('\n\n')}\n`;
	const seenOf = (t: string, i: number) => {
		const e = entrySpansOf(t)[i]!;
		return { entry: e.id, blocks: e.blocks.map((b) => b.key) };
	};
	// The person saw "Gym / Leg day." Then the bot added a line to it.
	const seen = day('## 09:00 · Gym', 'Leg day.', '## Notes', 'Other.');
	const now = day('## 09:00 · Gym', 'Leg day.', 'Remember to book the physio.', '## Notes', 'Other.');
	const gym = seenOf(seen, 0);
	assert.equal(code(plan(date, now, { op: 'remove', date, ...gym })), 'changed', 'the added line is never removed unseen');
	assert.equal(code(plan(date, now, { op: 'move', date, ...gym, before: null })), 'changed');
	// As seen, it goes.
	assert.equal(textOf(plan(date, seen, { op: 'remove', date, ...gym })), day('## Notes', 'Other.'));
	// Three entries under one heading: B is seen, then A is removed elsewhere, and B's id now names C.
	const three = day('## Note', 'A.', '## Note', 'B.', '## Note', 'C.');
	const b = seenOf(three, 1);
	const afterA = day('## Note', 'B.', '## Note', 'C.');
	assert.equal(code(plan(date, afterA, { op: 'remove', date, ...b })), 'changed', 'C is not taken for B');
});
