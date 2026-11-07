// The five tools as MCP lists them (docs/specification/plugin.md § Tools): names, JSON Schemas and descriptions, the one
// source of both `tools.list()` and the manifest's `tools`. Every description is a words key's text. Built on call, never
// at import, and importing no `node:` module, so the manifest can read it without the engine's code.
import type { ListedTool, ToolDecl } from '../../vendor/plugin-host/plugin-host.ts';
import { word, type WordKey } from '../words.ts';

/** The most days one `read_days` call reads (its description says so: tests/tools.test.ts holds them equal). */
export const READ_MAX_DAYS = 31;
/** The most characters of day text one `read_days` answer holds; always at least one day. */
export const READ_MAX_CHARS = 60000;
/** The most characters of writing one call takes. */
export const TEXT_MAX_CHARS = 20000;
/** The most characters of an entry's title. */
export const TITLE_MAX_CHARS = 80;

export const TOOL_NAMES = ['read_days', 'add_entry', 'replace_block', 'delete_block', 'insert_after'] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

type Schema = { [keyword: string]: unknown };

const described = (key: WordKey, schema: Schema): Schema => ({ ...schema, description: word(key) });

// The spec's shared parts, written out in each tool's schema.
const date = (key: WordKey = 'journal.tool.field.date') => described(key, { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' });
const time = (key: WordKey) => described(key, { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' });
const version = (key: WordKey = 'journal.tool.field.version') => described(key, { type: ['string', 'null'], pattern: '^[0-9a-f]{16}$' });
const text = (key: WordKey) => described(key, { type: 'string', minLength: 1, maxLength: TEXT_MAX_CHARS });
const nth = () => described('journal.tool.field.nth', { type: 'integer', minimum: 1 });

const object = (properties: Record<string, Schema>, required: string[]) =>
	({ type: 'object', additionalProperties: false, properties, required });

/** The anchor every change of existing writing names. */
const anchor = () => ({
	date: date(),
	version: version(),
	entry: time('journal.tool.field.entry'),
	block: text('journal.tool.field.block'),
});

interface ToolDef {
	name: ToolName;
	words: WordKey;
	input: Schema & { type: string };
	writes: boolean;
	/** MCP's hint that the tool may change or remove what is there. */
	destructive: boolean;
}

function defs(): ToolDef[] {
	return [
		{
			name: 'read_days', words: 'journal.tool.read_days', writes: false, destructive: false,
			input: object({ from: date('journal.tool.read_days.from'), to: date('journal.tool.read_days.to') }, ['from']),
		},
		{
			name: 'add_entry', words: 'journal.tool.add_entry', writes: true, destructive: false,
			input: object({
				date: date(),
				time: time('journal.tool.add_entry.time'),
				title: described('journal.tool.add_entry.title', { type: 'string', maxLength: TITLE_MAX_CHARS, pattern: '^[^\\r\\n]*$' }),
				text: text('journal.tool.field.writing'),
				version: version('journal.tool.add_entry.version'),
			}, ['date', 'time', 'text']),
		},
		{
			name: 'replace_block', words: 'journal.tool.replace_block', writes: true, destructive: true,
			input: object({ ...anchor(), text: text('journal.tool.replace_block.text'), nth: nth() }, ['date', 'version', 'entry', 'block', 'text']),
		},
		{
			name: 'delete_block', words: 'journal.tool.delete_block', writes: true, destructive: true,
			input: object({ ...anchor(), nth: nth() }, ['date', 'version', 'entry', 'block']),
		},
		{
			name: 'insert_after', words: 'journal.tool.insert_after', writes: true, destructive: false,
			input: object({ ...anchor(), text: text('journal.tool.field.writing'), nth: nth() }, ['date', 'version', 'entry', 'block', 'text']),
		},
	];
}

/** `tools.list()`: each tool as MCP's `tools/list` sends it. */
export function listedTools(): ListedTool[] {
	return defs().map((d) => ({
		name: d.name,
		description: word(d.words),
		inputSchema: d.input,
		annotations: { readOnlyHint: !d.writes, destructiveHint: d.destructive },
	}));
}

/** The manifest's `tools`: each tool's words key, the same schema `tools.list()` gives, and whether it writes. */
export function toolDecls(): ToolDecl[] {
	return defs().map((d) => ({ name: d.name, words: d.words, input: d.input, writes: d.writes }));
}
