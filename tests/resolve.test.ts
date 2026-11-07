// `resolve(kind, ref)` (docs/specification/plugin.md § Resolve): what a chip says now, or why it cannot go; never a throw.
import assert from 'node:assert/strict';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createEngine } from '../src/engine/engine.ts';
import { word } from '../src/engine/words.ts';
import { CHIP_DAYS, CHIP_TEXT_CHARS, addDays, dateHeading, dateTitle, keyedBlocks, rangeParts } from '../src/format/index.ts';
import { dayFile, writeDay } from '../src/store/index.ts';
import { CHIP_LIMITS, type ChipText, type ResolveAnswer } from '../src/vendor/plugin-host/plugin-host.ts';
import { scratch, sampleDays } from './fixtures/days.ts';

const DATE = '2026-10-01';

function engineOn(t: { after: (fn: () => void) => void }) {
	const { dir, done } = scratch();
	t.after(done);
	const warned: string[] = [];
	const engine = createEngine({ dir, name: () => 'A bot', warn: (m) => warned.push(m), flags: {} });
	return { dir, warned, resolve: async (kind: string, ref: unknown) => engine.resolve(kind, ref), read: (date = DATE) => readFileSync(dayFile(dir, date), 'utf8') };
}

const refused = (a: ResolveAnswer): string | null => ('refused' in a ? a.refused : null);
const within = (a: ResolveAnswer) => {
	if ('refused' in a) {
		assert.ok(a.refused.length <= CHIP_LIMITS.refusedChars && a.reason.length <= CHIP_LIMITS.reasonChars);
	} else {
		assert.ok(a.where.length <= CHIP_LIMITS.whereChars && a.text.length <= CHIP_LIMITS.textChars);
		assert.equal(a.ack, undefined);
	}
};

describe('a block chip', () => {
	it('a block chip says the block’s text now, and is gone once its text changed', async (t) => {
		const { resolve, read, dir } = engineOn(t);
		const blocks = keyedBlocks(read());
		const quote = blocks.find((b) => b.text.startsWith('>'))!;
		const said = (await resolve('block', { date: DATE, key: quote.key })) as ChipText;
		within(said);
		assert.deepEqual(said, { where: word('journal.chip.where-block', { title: dateTitle(DATE), entry: '21:30 · Evening walk' }), text: quote.text });
		const heading = (await resolve('block', { date: DATE, key: blocks[0]!.key })) as ChipText;
		assert.equal(heading.where, word('journal.chip.where-day', { title: dateTitle(DATE) }));
		writeFileSync(dayFile(dir, DATE), read().replace(quote.text, '> Changed by hand.'));
		assert.equal(refused(await resolve('block', { date: DATE, key: quote.key })), 'gone');
		assert.equal(refused(await resolve('block', { date: '2026-10-03', key: quote.key })), 'gone');
	});

	it('every block of every sample day resolves to its own text', async (t) => {
		const { resolve } = engineOn(t);
		for (const [date, text] of sampleDays()) {
			for (const b of keyedBlocks(text)) {
				const a = await resolve('block', { date, key: b.key });
				within(a);
				assert.equal((a as ChipText).text, b.text, `${date} ${b.key}`);
			}
		}
	});
});

describe('a days chip', () => {
	it('a days chip says each day with a page, and refuses a range too long', async (t) => {
		const { resolve, read } = engineOn(t);
		const a = (await resolve('days', { from: '2026-10-01', to: '2026-10-04' })) as ChipText;
		within(a);
		assert.equal(a.where, word('journal.chip.where-days', rangeParts('2026-10-01', '2026-10-04')));
		const texts = ['2026-10-01', '2026-10-02', '2026-10-04'].map((d) => read(d).trimEnd());
		assert.equal(a.text, texts.join('\n\n'));
		const empty = (await resolve('days', { from: '2026-10-10', to: '2026-10-11' })) as ChipText;
		assert.equal(empty.text, '');
		assert.equal(refused(await resolve('days', { from: '2026-10-01', to: addDays('2026-10-01', CHIP_DAYS) })), 'too-long');
		assert.equal(refused(await resolve('days', { from: '2026-10-01', to: addDays('2026-10-01', CHIP_DAYS - 1) })), null);
	});

	it('a days chip over CHIP_TEXT_CHARS is refused too-long', async (t) => {
		const { resolve, dir } = engineOn(t);
		writeDay(dir, '2026-10-03', `${dateHeading('2026-10-03')}\n\n## 09:00\n\n${'x'.repeat(CHIP_TEXT_CHARS)}\n`);
		assert.equal(refused(await resolve('days', { from: '2026-10-03', to: '2026-10-03' })), 'too-long');
	});
});

describe('any other', () => {
	it('an unknown kind or a ref of another shape is refused, never thrown at', async (t) => {
		const { resolve } = engineOn(t);
		const shapes: [string, unknown][] = [
			['page', { date: DATE }], ['block', null], ['block', 'x'], ['block', []], ['block', { date: DATE }],
			['block', { date: DATE, key: 'zz' }], ['block', { date: '2026-02-30', key: '00000000-0' }],
			['block', { date: DATE, key: '00000000-0', extra: 1 }], ['block', { date: 20261001, key: '00000000-0' }],
			['days', { from: '2026-10-05', to: '2026-10-01' }], ['days', { from: '../x', to: '2026-10-01' }], ['days', { from: DATE }],
			['block', { date: '../../etc', key: '00000000-0' }], ['__proto__', {}],
		];
		for (const [kind, ref] of shapes) {
			const a = await resolve(kind, ref);
			assert.equal(refused(a), 'gone', `${kind} ${JSON.stringify(ref)}`);
			within(a);
		}
	});

	it('a day it cannot read is refused gone and warned, never thrown', { skip: process.getuid?.() === 0 }, async (t) => {
		const { resolve, read, dir, warned } = engineOn(t);
		const key = keyedBlocks(read())[1]!.key;
		chmodSync(dayFile(dir, DATE), 0o000);
		try {
			assert.equal(refused(await resolve('block', { date: DATE, key })), 'gone');
			assert.equal(warned.length, 1);
		} finally {
			chmodSync(dayFile(dir, DATE), 0o644);
		}
	});
});
