// Every answer fits the contract's REPLY_LIMITS (review S2): measured as the host measures it, the whole reply as JSON. A
// legal day the bot can build (many tiny blocks, or text that grows when sent as JSON) still lets its week be read and an
// edit to it be answered; and an edit that lands always answers that it landed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createEngine } from '../src/engine/engine.ts';
import { MAX_DAY_BLOCKS, MAX_DAY_BYTES, MAX_DAY_JSON_BYTES, blocksOf, dateHeading } from '../src/format/index.ts';
import type { DaysAnswer, Edit } from '../src/seam-types.ts';
import { dayFile, dayFits, jsonBytes, version, writeDay } from '../src/store/index.ts';
import { REPLY_LIMITS, type EngineReply, type ToolResult } from '../src/vendor/plugin-host/plugin-host.ts';
import { scratch } from './fixtures/days.ts';

const DATE = '2026-11-04';
const WEEK = 'days?from=2026-11-02&to=2026-11-08';
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const head = `${dateHeading(DATE)}\n\n## 09:00\n\n`;
const BOT = { caller: { by: 'agent' as const, agent: 'bot-0123456789abcdef' }, signal: new AbortController().signal };

/** A legal day of `a` paragraphs, one per blank line, as near MAX_DAY_BYTES as fits. */
const tinyBlocks = () => `${head}${'a\n\n'.repeat(Math.floor((MAX_DAY_BYTES - head.length - 2) / 3))}b\n`;
/** A legal day of one paragraph of U+0001, which JSON sends as six bytes each. */
const control = () => `${head}${'\u0001'.repeat(MAX_DAY_BYTES - head.length - 1)}\n`;

function engineOn(t: { after: (fn: () => void) => void }) {
	const { dir, done } = scratch(true);
	t.after(done);
	const engine = createEngine({ dir, name: () => 'A bot', warn: () => {}, flags: {} });
	const call = async (method: string, path: string, body?: unknown): Promise<EngineReply> => {
		const [p = '', q = ''] = path.split('?');
		return (await engine.route({ method, path: p, query: new URLSearchParams(q), body }, { caller: { by: 'person' }, signal: new AbortController().signal }))!;
	};
	const tool = (name: string, input: Record<string, unknown>): Promise<ToolResult> => Promise.resolve(engine.tools.call(name, input, BOT));
	return { dir, call, tool, read: () => readFileSync(dayFile(dir, DATE), 'utf8') };
}

/** An edit's reply fits, and says it landed exactly when the file changed. */
function honest(reply: EngineReply, before: string, after: string): void {
	assert.ok(bytes(reply) <= REPLY_LIMITS.bytes, `the reply is ${bytes(reply)} bytes`);
	assert.equal(reply.status === 200, before !== after, `status ${reply.status}, the file ${before === after ? 'unchanged' : 'changed'}`);
}

describe('every answer fits REPLY_LIMITS', () => {
	for (const [name, make] of [['tiny blocks', tinyBlocks], ['U+0001 text', control]] as const) {
		it(`a legal day of ${name} lets its week be read, and an edit to it answers within the limit`, async (t) => {
			const { dir, call, tool, read } = engineOn(t);
			const day = make();
			assert.ok(Buffer.byteLength(day) <= MAX_DAY_BYTES, 'the day is legal by size');
			writeDay(dir, DATE, day);
			writeDay(dir, '2026-11-03', `${dateHeading('2026-11-03')}\n\n## 08:00\n\nA small day.\n`);
			const week = await call('GET', WEEK);
			assert.equal(week.status, 200);
			assert.ok(bytes(week) <= REPLY_LIMITS.bytes, `GET days is ${bytes(week)} bytes`);
			const { days, next } = week.body as DaysAnswer;
			assert.equal(next, undefined, 'the whole week in one answer');
			const big = days.find((d) => d.date === DATE)!;
			assert.deepEqual([big.exists, big.version, big.blocks], [true, null, []], 'the day is too big to read');
			const read_ = await tool('read_days', { from: '2026-11-02', to: '2026-11-08' });
			assert.ok(bytes(read_) <= REPLY_LIMITS.bytes, `read_days is ${bytes(read_)} bytes`);
			const b = blocksOf(day)[2]!;
			const before = read();
			const e: Edit = { op: 'insert', date: DATE, start: b.start, end: b.end, before: b.text, text: 'More.' };
			honest(await call('POST', 'edit', e), before, read());
			const w = await tool('insert_after', { date: DATE, version: version(before), entry: '09:00', block: b.text, nth: 1, text: 'More.' });
			assert.ok(bytes(w) <= REPLY_LIMITS.bytes, `insert_after is ${bytes(w)} bytes`);
		});
	}

	it('an edit that lands never answers as if it failed, even with a large undo', async (t) => {
		const { dir, call, read } = engineOn(t);
		// Two blocks of U+0001 swapped for two that differ at both ends: the day fits, but the day with the undo of both does not.
		const block = '\u0001'.repeat(30000);
		writeDay(dir, DATE, `${head}${block}\n\n${block}x\n`);
		const before = read();
		const e: Edit = { op: 'range', date: DATE, start: head.length, end: before.length - 1, before: before.slice(head.length, -1), after: `y${block}\n\nz${block}` };
		honest(await call('POST', 'edit', e), before, read());
		// An ordinary edit to the same day lands, and says so.
		const small = blocksOf(read())[2]!;
		const now = read();
		honest(await call('POST', 'edit', { op: 'insert', date: DATE, start: small.start, end: small.end, before: small.text, text: 'More.' }), now, read());
		assert.notEqual(read(), now);
	});

	it('a day at every limit at once still answers alone within the limit, by the route and the tool', async (t) => {
		const { dir, call, tool } = engineOn(t);
		// As many paragraphs as a day may hold, of U+0001 as long as its JSON limit allows.
		const n = MAX_DAY_BLOCKS - 2;
		const each = Math.floor((MAX_DAY_JSON_BYTES - jsonBytes(head) - n * 4) / (n * 6));
		const day = `${head}${Array.from({ length: n }, () => '\u0001'.repeat(each)).join('\n\n')}\n`;
		assert.equal(blocksOf(day).length, MAX_DAY_BLOCKS);
		assert.ok(jsonBytes(day) > MAX_DAY_JSON_BYTES * 0.95, 'near the JSON limit');
		assert.ok(dayFits(day), 'and inside it');
		writeDay(dir, DATE, day);
		const one = await call('GET', `days?from=${DATE}&to=${DATE}`);
		assert.equal((one.body as DaysAnswer).days[0]!.blocks.length, MAX_DAY_BLOCKS);
		assert.ok(bytes(one) <= REPLY_LIMITS.bytes, `GET days is ${bytes(one)} bytes`);
		const r = await tool('read_days', { from: DATE });
		assert.equal(r.isError, false);
		assert.ok(bytes(r) <= REPLY_LIMITS.bytes, `read_days is ${bytes(r)} bytes`);
	});
});
