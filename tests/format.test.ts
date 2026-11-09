import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	KEY_RE, blocksOf, checkDay, dateHeading, dateOfPath, dateTitle, datesBetween, dayPath, entriesOf, entryHeading, entryOf, hash, isDate,
	keyedBlocks, rangeParts,
} from '../src/format/index.ts';
import { parseMarkdown } from '../src/vendor/markdown/index.ts';
import { sampleDays } from './fixtures/days.ts';

describe('dates', () => {
	it('a date is a real calendar day in YYYY-MM-DD form', () => {
		for (const d of ['2026-11-07', '2024-02-29', '2026-01-01']) assert.ok(isDate(d), d);
		for (const d of ['2026-02-29', '2026-13-01', '2026-1-1', '../2026-10-01', '', 20261107, null]) assert.ok(!isDate(d), String(d));
	});

	it('a day file lives at YYYY/MM/YYYY-MM-DD.md, and only there', () => {
		assert.equal(dayPath('2026-11-07'), '2026/11/2026-11-07.md');
		assert.equal(dateOfPath('2026/11/2026-11-07.md'), '2026-11-07');
		assert.equal(dateOfPath('2026/10/2026-11-07.md'), null);
		assert.equal(dateOfPath('2026/02/2026-02-30.md'), null);
		assert.equal(dateOfPath('2026/11/notes.md'), null);
	});

	it('titles and ranges are said in words, worked out in UTC', () => {
		assert.equal(dateTitle('2026-11-07'), 'Saturday 7 November 2026');
		assert.deepEqual(rangeParts('2026-11-02', '2026-11-08'), { from: '2', to: '8 November 2026' });
		assert.deepEqual(rangeParts('2026-09-28', '2026-10-04'), { from: '28 September', to: '4 October 2026' });
		assert.deepEqual(rangeParts('2026-12-28', '2027-01-03'), { from: '28 December 2026', to: '3 January 2027' });
		assert.equal(datesBetween('2026-10-30', '2026-11-02').length, 4);
	});
});

describe('the day file', () => {
	it('every sample day keeps the rules', () => {
		const days = sampleDays();
		assert.ok(days.length >= 10);
		for (const [date, text] of days) assert.deepEqual(checkDay(date, text), [], date);
	});

	it('a day that breaks the rules says each problem once', () => {
		const date = '2026-10-01';
		const codes = (text: string) => checkDay(date, text).map((p) => p.code);
		assert.deepEqual(codes('# Friday 2 October 2026\n'), ['date-line']);
		assert.deepEqual(codes(`${dateHeading(date)}\n\nLoose words.\n\nMore loose words.\n`), ['outside-entry']);
		assert.deepEqual(codes(`${dateHeading(date)}\n\n## 25:00\n\nx\n`), ['entry-heading']);
		assert.deepEqual(codes(`${dateHeading(date)}\n\n## 09:00\n\n\`\`\`\ncode\n\`\`\`\n`), ['body-kind']);
		assert.deepEqual(codes(`${dateHeading(date)}\r\n\r\n## 09:00\r\n`), ['line-ends']);
		assert.deepEqual(codes(`${dateHeading(date)}\n\n## 09:00\n\n<b>bold</b>\n`), ['html']);
		assert.deepEqual(codes(''), ['date-line']);
	});

	it('an entry heading is a time from 00:00 to 23:59, then an optional title', () => {
		assert.deepEqual(entryOf('## 21:30 · Walk'), { time: '21:30', title: 'Walk' });
		assert.deepEqual(entryOf('## 00:00'), { time: '00:00', title: null });
		for (const t of ['## 24:00', '## 9:00', '## 09:60', '# 09:00', '## 09:00 Walk']) assert.equal(entryOf(t), null, t);
	});

	it('an entry may have no time: a title alone, one that does not start like a time (GM, 2026-11-09)', () => {
		assert.deepEqual(entryOf('## Morning walk'), { time: null, title: 'Morning walk' });
		assert.deepEqual(entryOf('## 21 sheep on the road'), { time: null, title: '21 sheep on the road' });
		for (const t of ['## 9:30 tea', '## 09:30tea'.replace('tea', ' tea'), '##', '## ']) assert.equal(entryOf(t), null, t);
		for (const [time, title] of [['21:30', 'Walk'], ['21:30', null], [null, 'Walk']] as const) {
			assert.deepEqual(entryOf(entryHeading(time, title)), { time, title }, 'a heading reads back as itself');
		}
		const day = `${dateHeading('2026-11-09')}\n\n## Morning walk\n\nCold.\n\n## 10:40 · Sheep\n\nMany.\n\n## Evening\n\nQuiet.\n`;
		assert.deepEqual(checkDay('2026-11-09', day), [], 'a day of entries with and without times keeps the rules');
		const entries = entriesOf(day);
		assert.deepEqual(entries.map((e) => [e.time, e.title]), [[null, 'Morning walk'], ['10:40', 'Sheep'], [null, 'Evening']]);
		assert.deepEqual(entries.map((e) => e.id), keyedBlocks(day).filter((b) => b.text.startsWith('## ')).map((b) => b.key), 'an entry’s id is its heading’s key');
	});
});

describe('blocks and keys', () => {
	it('the blocks are the parser’s, and their slices are the file', () => {
		for (const [date, text] of sampleDays()) {
			const blocks = blocksOf(text);
			assert.deepEqual(blocks.map((b) => parseMarkdown(b.text)[0]!.kind), blocks.map((b) => b.kind), date);
			for (const b of blocks) assert.equal(text.slice(b.start, b.end), b.text, date);
		}
	});

	it('a key is the text’s FNV-1a hash and its count among equal blocks', () => {
		assert.equal(hash(''), '811c9dc5');
		assert.equal(hash('a'), 'e40c292c');
		const keys = keyedBlocks('# Thursday 1 October 2026\n\n## 09:00\n\nSame.\n\nSame.\n').map((b) => b.key);
		assert.equal(keys[2], `${hash('Same.')}-0`);
		assert.equal(keys[3], `${hash('Same.')}-1`);
		for (const k of keys) assert.match(k, KEY_RE);
	});

	it('a block that did not change keeps its key when a block above it is added', () => {
		const text = sampleDays().find(([d]) => d === '2026-10-01')![1];
		const before = keyedBlocks(text);
		const after = keyedBlocks(text.replace('## 06:50\n\n', '## 06:50\n\nA new first line.\n\n'));
		const last = before.at(-1)!;
		assert.equal(after.find((b) => b.text === last.text)!.key, last.key);
	});
});
