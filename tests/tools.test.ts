// The bot's tools (docs/specification/plugin.md § Tools), through `createEngine` as nclite calls them: `tools.call` with the
// bot as the caller. Every write works on a private copy of the sample days.
import assert from 'node:assert/strict';
import { chmodSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createEngine } from '../src/engine/engine.ts';
import { word } from '../src/engine/words.ts';
import { READ_MAX_CHARS } from '../src/engine/tools/index.ts';
import { MAX_DAY_BYTES, blocksOf, dateHeading, keyedBlocks } from '../src/format/index.ts';
import { CHANGE_WORDS, PLUGIN_ID } from '../src/manifest.ts';
import type { ReadResult, WriteResult } from '../src/seam-types.ts';
import { dayFile, version, writeDay } from '../src/store/index.ts';
import {
	CHANGE_EXAMPLES, CHANGE_LIMITS, CHANGE_META, REF_LIMITS, type Ref, type ToolResult,
} from '../src/vendor/plugin-host/plugin-host.ts';
import { scratch } from './fixtures/days.ts';

const DATE = '2026-10-01';
const BOT = { caller: { by: 'agent' as const, agent: 'bot-0123456789abcdef' }, signal: new AbortController().signal };

/** The tools' today in these tests: after every day they write, before the future days the `future` tests use. */
const TODAY = '2026-11-30';

function toolsOn(t: { after: (fn: () => void) => void }, empty = false, today = TODAY) {
	const { dir, done } = scratch(empty);
	t.after(done);
	const warned: string[] = [];
	const engine = createEngine({ dir, name: () => 'A bot', warn: (m) => warned.push(m), flags: {} }, { today: () => today });
	const heard: Ref[] = [];
	t.after(engine.watch((ref) => heard.push(ref)));
	const call = (name: string, input: Record<string, unknown>) => engine.tools.call(name, input, BOT);
	const read = (date = DATE) => readFileSync(dayFile(dir, date), 'utf8');
	/** Every file under the folder with its bytes, to prove a refusal wrote nothing. */
	const snapshot = () => (readdirSync(dir, { recursive: true }) as string[]).sort()
		.filter((f) => statSync(join(dir, f)).isFile()).map((f) => [f, readFileSync(join(dir, f), 'utf8')]);
	return { dir, call, read, snapshot, heard, warned };
}

const text = (r: ToolResult) => r.content.map((c) => c.text).join('\n');
const refusal = (r: ToolResult) => (r.isError ? (r.structuredContent as { refused: string }).refused : null);
const wrote = (r: ToolResult) => {
	assert.equal(r.isError, false, text(r));
	return r.structuredContent as WriteResult;
};

/** The block of `date`'s text at `index`. */
const blockAt = (body: string, index: number) => blocksOf(body)[index]!;

/** Whether `meta` is a change line nclite records for `plugin`, whose manifest lists `words` (the contract's bounds). */
function recordable(meta: unknown, plugin: string, words: readonly string[]): boolean {
	if (typeof meta !== 'object' || meta === null) return false;
	const c = (meta as Record<string, unknown>)[CHANGE_META] as Record<string, unknown> | undefined;
	if (typeof c !== 'object' || c === null) return false;
	const { words: w, count, subject, reveal } = c;
	if (typeof w !== 'string' || !w.startsWith(`${plugin}.`) || !words.includes(w)) return false;
	if (!Number.isSafeInteger(count) || (count as number) < 0 || (count as number) > CHANGE_LIMITS.maxCount) return false;
	if (typeof subject !== 'string' || subject.length > CHANGE_LIMITS.subjectChars || /[\u0000-\u001f\u007f]/.test(subject)) return false;
	if (reveal === undefined) return true;
	if (typeof reveal !== 'object' || reveal === null || JSON.stringify(reveal).length > REF_LIMITS.maxChars) return false;
	const entries = Object.entries(reveal);
	return entries.length <= REF_LIMITS.maxKeys && entries.every(([k, v]) =>
		new RegExp(REF_LIMITS.keyPattern).test(k) && (typeof v !== 'string' || v.length <= REF_LIMITS.maxString));
}

describe('read_days', () => {
	it('read_days gives each day with its version and says where to read on', async (t) => {
		const { call, read, dir } = toolsOn(t);
		const r = await call('read_days', { from: '2026-10-01', to: '2026-10-03' });
		assert.equal(r.isError, false);
		const { days, next } = r.structuredContent as ReadResult;
		assert.equal(next, undefined);
		assert.deepEqual(days.map((d) => [d.date, d.exists]), [['2026-10-01', true], ['2026-10-02', true], ['2026-10-03', false]]);
		assert.deepEqual(days[0], { date: DATE, title: 'Thursday 1 October 2026', exists: true, version: version(read()), text: read(), problems: [] });
		assert.deepEqual(days[2], { date: '2026-10-03', title: 'Saturday 3 October 2026', exists: false, version: null, text: '', problems: [] });
		assert.ok(text(r).includes(version(read())) && text(r).includes(read().trimEnd()), 'the text holds each day and its version');
		// `to` left out reads one day.
		assert.deepEqual(((await call('read_days', { from: DATE })).structuredContent as ReadResult).days.map((d) => d.date), [DATE]);
		// Whole days until the next would not fit; always at least one; `next` the first left out.
		const big = (date: string) => `${dateHeading(date)}\n\n## 09:00\n\n${'w'.repeat(Math.floor(READ_MAX_CHARS * 0.6))}\n`;
		for (const date of ['2026-11-02', '2026-11-03']) writeDay(dir, date, big(date));
		const part = await call('read_days', { from: '2026-11-01', to: '2026-11-08' });
		const got = part.structuredContent as ReadResult;
		assert.deepEqual(got.days.map((d) => d.date), ['2026-11-01', '2026-11-02']);
		assert.equal(got.next, '2026-11-03');
		assert.ok(text(part).includes('2026-11-03'), 'the text says where to read on');
		assert.deepEqual(((await call('read_days', { from: '2026-11-03' })).structuredContent as ReadResult).days.length, 1);
	});

	it('a day that breaks the rules is read with its problems, and one too big is named and not read', async (t) => {
		const { call, dir } = toolsOn(t, true);
		writeDay(dir, '2026-11-05', '# Thursday 5 November 2026\n\nWriting outside an entry.\n');
		writeDay(dir, '2026-11-06', `${dateHeading('2026-11-06')}\n\n## 09:00\n\n${'w'.repeat(MAX_DAY_BYTES)}\n`);
		const r = await call('read_days', { from: '2026-11-05', to: '2026-11-06' });
		const [broken, big] = (r.structuredContent as ReadResult).days;
		assert.equal(broken!.problems.length, 1);
		assert.ok(text(r).includes(broken!.problems[0]!) && text(r).includes('Writing outside an entry.'));
		assert.deepEqual([big!.exists, big!.version, big!.text, big!.problems.length], [true, null, '', 1]);
	});
});

describe('a write to a day after today', () => {
	const TOMORROW = '2026-12-01';
	const page = (date: string) => `${dateHeading(date)}\n\n## 09:00\n\nPlanned.\n`;
	// Each write tool aimed at `date`, whose page (when it has one) holds a `## 09:00` entry with the block `Planned.`.
	const writes: [string, (date: string, v: string | null) => Record<string, unknown>][] = [
		['add_entry', (date, v) => ({ date, time: '10:00', text: 'Later.', version: v })],
		['insert_after', (date, v) => ({ date, version: v, entry: '09:00', block: 'Planned.', text: 'More.' })],
		['replace_block', (date, v) => ({ date, version: v, entry: '09:00', block: 'Planned.', text: 'Changed.' })],
		['delete_block', (date, v) => ({ date, version: v, entry: '09:00', block: 'Planned.' })],
	];

	for (const [tool, input] of writes) {
		it(`${tool} is refused for tomorrow as future, with the words, and nothing is written`, async (t) => {
			const { call, dir, snapshot, heard } = toolsOn(t);
			writeDay(dir, TOMORROW, page(TOMORROW));
			const before = snapshot();
			const r = await call(tool, input(TOMORROW, version(page(TOMORROW))));
			assert.equal(refusal(r), 'future', text(r));
			assert.equal(text(r), word('journal.refusal.future', { title: 'Tuesday 1 December 2026', today: TODAY }));
			assert.deepEqual(snapshot(), before);
			assert.deepEqual(heard, []);
			// A day with no page is refused the same way, not as `no-page`.
			assert.equal(refusal(await call(tool, input('2027-01-15', null))), 'future');
		});

		it(`${tool} on today or yesterday is not affected, with or without future`, async (t) => {
			const { call, dir } = toolsOn(t);
			for (const date of [TODAY, '2026-11-29']) {
				writeDay(dir, date, page(date));
				assert.equal(refusal(await call(tool, input(date, version(page(date))))), null, date);
			}
			writeDay(dir, '2026-11-28', page('2026-11-28'));
			wrote(await call(tool, { ...input('2026-11-28', version(page('2026-11-28'))), future: true }));
		});
	}

	it('with future: true a page that exists is changed by every tool', async (t) => {
		const { call, dir, read } = toolsOn(t);
		for (const [tool, input] of writes) {
			writeDay(dir, TOMORROW, page(TOMORROW));
			wrote(await call(tool, { ...input(TOMORROW, version(page(TOMORROW))), future: true }));
			assert.notEqual(read(TOMORROW), page(TOMORROW), tool);
		}
	});

	it('future must be a boolean', async (t) => {
		const { call } = toolsOn(t);
		assert.equal(refusal(await call('add_entry', { date: TOMORROW, time: '10:00', text: 'x', future: 'yes' })), 'input');
	});
});

describe('the writes', () => {
	it('add_entry places an entry by time and makes a missing page', async (t) => {
		const { call, read, heard } = toolsOn(t);
		const before = read();
		const r = await call('add_entry', { date: DATE, time: '10:00', title: 'Coffee', text: 'A long one.', version: version(before) });
		const w = wrote(r);
		const at = before.indexOf('## 13:15');
		assert.equal(read(), `${before.slice(0, at)}## 10:00 · Coffee\n\nA long one.\n\n${before.slice(at)}`);
		assert.deepEqual(w, { date: DATE, version: version(read()), entry: '10:00', key: keyedBlocks(read()).find((b) => b.text === '## 10:00 · Coffee')!.key });
		assert.deepEqual(heard, [{ date: DATE }], 'the write is said at once');
		// No version: placed in the day as it is now; a day with no page gets one.
		wrote(await call('add_entry', { date: DATE, time: '23:00', text: 'Late.' }));
		assert.ok(read().endsWith('## 23:00\n\nLate.\n'));
		const fresh = wrote(await call('add_entry', { date: '2026-11-07', time: '08:00', text: '- [ ] Post the letter', version: null }));
		assert.equal(read('2026-11-07'), '# Saturday 7 November 2026\n\n## 08:00\n\n- [ ] Post the letter\n');
		assert.equal(fresh.version, version(read('2026-11-07')));
	});

	it('replace, delete and insert change only the anchored block', async (t) => {
		const { call, read } = toolsOn(t);
		const anchor = (index: number) => ({ date: DATE, version: version(read()), entry: '13:15', block: blockAt(read(), index).text });
		const splice = (body: string, index: number, to: string) => {
			const b = blockAt(body, index);
			return body.slice(0, b.start) + to + body.slice(b.end);
		};
		// Blocks of the sample day: 4 is "## 13:15 · Work going well", 5 and 6 its paragraphs.
		let was = read();
		let w = wrote(await call('replace_block', { ...anchor(5), text: 'The meeting went fine.' }));
		assert.equal(read(), splice(was, 5, 'The meeting went fine.'));
		assert.equal(w.key, keyedBlocks(read())[5]!.key);
		was = read();
		w = wrote(await call('insert_after', { ...anchor(5), text: 'Then lunch.\n\n- soup' }));
		assert.equal(read(), splice(was, 5, `${blockAt(was, 5).text}\n\nThen lunch.\n\n- soup`));
		assert.equal(w.key, keyedBlocks(read())[6]!.key);
		was = read();
		w = wrote(await call('delete_block', { ...anchor(6) }));
		assert.equal(read(), was.slice(0, blockAt(was, 6).start) + was.slice(blockAt(was, 7).start));
		assert.equal(w.key, undefined);
		// The heading is a block: replacing it moves the entry to a new time.
		was = read();
		w = wrote(await call('replace_block', { ...anchor(4), block: '## 13:15 · Work going well', text: '## 13:30 · Work' }));
		assert.equal(read(), splice(was, 4, '## 13:30 · Work'));
		assert.equal(w.entry, '13:30');
		// A block is matched whole, with the whitespace round it set aside.
		was = read();
		wrote(await call('delete_block', { date: DATE, version: version(was), entry: '06:50', block: `  ${blockAt(was, 2).text}\n` }));
		assert.equal(read(), was.slice(0, blockAt(was, 2).start) + was.slice(blockAt(was, 3).start));
	});

	it('a stale version is refused and nothing is written', async (t) => {
		const { call, read, snapshot, heard } = toolsOn(t);
		const before = snapshot();
		const old = version(read());
		const b = blockAt(read(), 5).text;
		for (const v of ['0123456789abcdef', null]) {
			assert.equal(refusal(await call('replace_block', { date: DATE, version: v, entry: '13:15', block: b, text: 'x' })), 'stale');
			assert.equal(refusal(await call('add_entry', { date: DATE, version: v, time: '10:00', text: 'x' })), 'stale');
		}
		assert.equal(refusal(await call('add_entry', { date: '2026-11-07', version: old, time: '10:00', text: 'x' })), 'stale');
		assert.deepEqual(snapshot(), before);
		assert.deepEqual(heard, []);
	});

	it('an ambiguous anchor is refused unless nth says which', async (t) => {
		const { call, read, dir } = toolsOn(t, true);
		writeDay(dir, DATE, '# Thursday 1 October 2026\n\n## 09:00\n\nSame.\n\nOther.\n\nSame.\n\n## 10:00\n\nSame.\n');
		const at = () => ({ date: DATE, version: version(read()), entry: '09:00', block: 'Same.' });
		const r = await call('delete_block', at());
		assert.equal(refusal(r), 'ambiguous');
		assert.ok(text(r).includes('2'), 'the refusal says how many match');
		assert.equal(refusal(await call('delete_block', { ...at(), nth: 3 })), 'ambiguous');
		wrote(await call('delete_block', { ...at(), nth: 2 }));
		assert.equal(read(), '# Thursday 1 October 2026\n\n## 09:00\n\nSame.\n\nOther.\n\n## 10:00\n\nSame.\n');
		wrote(await call('replace_block', { ...at(), text: 'Changed.' }));
		assert.equal(read(), '# Thursday 1 October 2026\n\n## 09:00\n\nChanged.\n\nOther.\n\n## 10:00\n\nSame.\n');
	});

	it('a write\'s _meta is the contract\'s change line, inside its bounds', async (t) => {
		// The checker holds the contract's worked example first, so it is the contract's rule.
		assert.ok(recordable(CHANGE_EXAMPLES.meta, 'example', ['example.change.edited']));
		for (const none of CHANGE_EXAMPLES.none) assert.ok(!recordable(none, 'example', ['example.change.edited']), JSON.stringify(none));
		const { call, read } = toolsOn(t);
		const at = (index: number) => ({ date: DATE, version: version(read()), entry: '13:15', block: blockAt(read(), index).text });
		const results = [
			await call('add_entry', { date: DATE, time: '10:00', text: 'One.\n\nTwo.' }),
			await call('replace_block', { ...at(8), text: 'Changed.' }),
			await call('insert_after', { ...at(8), text: 'A.\n\nB.\n\n- c' }),
			await call('delete_block', { ...at(8) }),
		];
		const metas = results.map((r) => r._meta?.[CHANGE_META] as { words: string; count: number; subject: string; reveal: Ref });
		assert.deepEqual(metas.map((m) => [m.words, m.count]), [
			['journal.change.entry', 1], ['journal.change.replace', 1], ['journal.change.insert', 3], ['journal.change.delete', 1],
		]);
		for (const [i, r] of results.entries()) {
			assert.ok(recordable(r._meta, PLUGIN_ID, CHANGE_WORDS), JSON.stringify(r._meta));
			const w = r.structuredContent as WriteResult;
			assert.equal(metas[i]!.subject, 'Thursday 1 October 2026');
			assert.deepEqual(metas[i]!.reveal, w.key === undefined ? { date: DATE } : { date: DATE, key: w.key });
		}
		assert.deepEqual(new Set(metas.map((m) => m.words)), new Set(CHANGE_WORDS), 'every change word is one a tool says');
		assert.equal((await call('read_days', { from: DATE }))._meta, undefined);
		assert.equal((await call('delete_block', { ...at(8), version: '0123456789abcdef' }))._meta, undefined, 'a refusal carries no change');
	});
});

describe('refusals', () => {
	it('every refusal is a result with its code, never a throw', async (t) => {
		const { call, read, dir, snapshot } = toolsOn(t);
		writeDay(dir, '2026-11-05', '# Thursday 5 November 2026\n\nWriting outside an entry.\n');
		writeDay(dir, '2026-11-06', `${dateHeading('2026-11-06')}\n\n## 09:00\n\n${'w'.repeat(MAX_DAY_BYTES)}\n`);
		writeDay(dir, '2026-11-09', `${dateHeading('2026-11-09')}\n\n## 09:00\n\n${'w'.repeat(MAX_DAY_BYTES - 100)}\n`);
		writeDay(dir, '2026-11-08', '# Sunday 8 November 2026\n\n## 09:00\n\nOne.\n\n## 09:00\n\nTwo.\n');
		const v = (date = DATE) => version(read(date));
		const at = (entry: string, block: string, date = DATE) => ({ date, version: v(date), entry, block });
		const cases: [string, string, Record<string, unknown>][] = [
			['input', 'read_days', { from: '2026-10-01', to: 'tomorrow' }],
			['dates', 'read_days', { from: '2026-10-05', to: '2026-10-01' }],
			['dates', 'read_days', { from: '2026-01-01', to: '2026-03-01' }],
			['stale', 'insert_after', { ...at('06:50', blockAt(read(), 2).text), version: '0123456789abcdef', text: 'x' }],
			['no-page', 'delete_block', { date: '2026-11-07', version: null, entry: '09:00', block: 'x' }],
			['no-entry', 'delete_block', at('09:00', 'x')],
			['ambiguous-entry', 'delete_block', at('09:00', 'One.', '2026-11-08')],
			['no-block', 'delete_block', at('06:50', 'Not on the page.')],
			['entry-exists', 'add_entry', { date: DATE, time: '13:15', text: 'x' }],
			['entry-exists', 'replace_block', { ...at('06:50', '## 06:50'), text: '## 13:15' }],
			['heading', 'insert_after', { ...at('06:50', blockAt(read(), 2).text), text: '## 07:00' }],
			['heading', 'add_entry', { date: DATE, time: '07:00', text: 'x\n\n# A heading' }],
			['heading', 'replace_block', { ...at('06:50', '## 06:50'), text: 'Not a heading.' }],
			['date-heading', 'delete_block', at('06:50', '# Thursday 1 October 2026')],
			['rules', 'insert_after', { ...at('06:50', blockAt(read(), 2).text), text: '```\ncode\n```' }],
			['rules', 'replace_block', { ...at('06:50', blockAt(read(), 2).text), text: 'A <b>tag</b>.' }],
			['malformed', 'add_entry', { date: '2026-11-05', time: '10:00', text: 'x' }],
			['too-big', 'add_entry', { date: '2026-11-06', time: '10:00', text: 'x' }],
			['too-big', 'add_entry', { date: '2026-11-09', time: '10:00', text: 'w'.repeat(200) }],
			['tool', 'write_file', { path: 'x' }],
		];
		const seen = new Set<string>();
		for (const [code, name, input] of cases) {
			const before = snapshot();
			const r = await call(name, input);
			assert.equal(refusal(r), code, `${name} ${JSON.stringify(input).slice(0, 120)}: ${text(r)}`);
			assert.equal(r.content.length, 1);
			assert.ok(!/\{\w+\}/.test(text(r)), `every placeholder is filled: ${text(r)}`);
			assert.deepEqual(snapshot(), before, `${code} wrote nothing`);
			seen.add(code);
		}
		// A failure to read is a refusal and a warning, never a throw.
		const { call: call2, dir: dir2, warned } = toolsOn(t);
		chmodSync(join(dir2, '2026/10'), 0o000);
		const failed = await call2('read_days', { from: DATE }).finally(() => chmodSync(join(dir2, '2026/10'), 0o755));
		assert.equal(refusal(failed), 'failed');
		assert.equal(warned.length, 1);
		seen.add('failed');
		assert.deepEqual([...seen].sort(), [
			'ambiguous-entry', 'date-heading', 'dates', 'entry-exists', 'failed', 'heading', 'input', 'malformed', 'no-block', 'no-entry',
			'no-page', 'rules', 'stale', 'too-big', 'tool',
		], 'every code is reached (ambiguous has its own test)');
	});

	it('an input outside its schema is refused input', async (t) => {
		const { call, read, snapshot } = toolsOn(t);
		const ok = { date: DATE, version: version(read()), entry: '06:50', block: blockAt(read(), 2).text, text: 'x' };
		const bad: [string, string, unknown][] = [
			['date', 'read_days', { to: DATE }],
			['extra', 'read_days', { from: DATE, extra: 1 }],
			['from', 'read_days', { from: 20261001 }],
			['from', 'read_days', { from: '2026-02-30' }],
			['input', 'read_days', null],
			['input', 'read_days', [DATE]],
			['version', 'replace_block', { ...ok, version: 'ABC' }],
			['version', 'replace_block', { ...ok, version: undefined }],
			['nth', 'replace_block', { ...ok, nth: 0 }],
			['nth', 'replace_block', { ...ok, nth: 1.5 }],
			['text', 'replace_block', { ...ok, text: '' }],
			['text', 'replace_block', { ...ok, text: '  \n ' }],
			['text', 'insert_after', { ...ok, text: 'w'.repeat(20001) }],
			['time', 'add_entry', { date: DATE, time: '24:00', text: 'x' }],
			['title', 'add_entry', { date: DATE, time: '10:00', title: 'Two\nlines', text: 'x' }],
			['title', 'add_entry', { date: DATE, time: '10:00', title: 't'.repeat(81), text: 'x' }],
			['date', 'add_entry', { date: '2026-02-30', time: '10:00', text: 'x' }],
		];
		const before = snapshot();
		for (const [field, name, input] of bad) {
			const r = await call(name, input as Record<string, unknown>);
			assert.equal(refusal(r), 'input', `${name} ${JSON.stringify(input)?.slice(0, 80)}`);
			// `read_days` without `from` names it; a non-object names the input.
			const named = field === 'date' && name === 'read_days' ? 'from' : field;
			assert.ok(text(r).includes(named), `${text(r)} names ${named}`);
		}
		assert.deepEqual(snapshot(), before);
	});
});

describe('the list', () => {
	it('lists the five tools, each with a closed object schema, and says the instructions', async (t) => {
		const { dir, done } = scratch(true);
		t.after(done);
		const engine = createEngine({ dir, name: () => 'A bot', warn: () => {}, flags: {} });
		const listed = engine.tools.list();
		assert.deepEqual(listed.map((l) => l.name), ['read_days', 'add_entry', 'replace_block', 'delete_block', 'insert_after']);
		for (const l of listed) {
			assert.equal(l.inputSchema.type, 'object');
			assert.equal(l.inputSchema.additionalProperties, false);
			assert.equal(l.annotations?.readOnlyHint, l.name === 'read_days');
			for (const p of Object.values(l.inputSchema.properties as Record<string, { description?: string }>)) assert.ok(p.description, l.name);
		}
		assert.ok(engine.tools.instructions?.includes('read_days'));
	});
});
