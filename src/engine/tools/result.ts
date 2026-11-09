// A tool's answer in MCP's shape (the contract's `ToolResult`): text for the bot, `structuredContent` for code, and a
// refusal as `isError: true` with `{ refused: <code> }`, never a throw. Every sentence is a words key's.
import { CHANGE_META, type ChangeMeta, type ToolResult } from '../../vendor/plugin-host/plugin-host.ts';
import { word, type WordKey } from '../words.ts';

/** Why a tool did not do what it was asked (docs/specification/plugin.md § Tools, Refusals). */
export type ToolRefusal =
	| 'input' | 'dates' | 'stale' | 'no-page' | 'no-entry' | 'untimed' | 'no-block' | 'ambiguous' | 'entry-exists'
	| 'future' | 'heading' | 'date-heading' | 'rules' | 'malformed' | 'too-big' | 'tool' | 'failed';

/** Each refusal's sentence. A store refusal that already has its words (`would-be-too-big`) passes its own key. */
const REFUSAL_WORDS: Record<ToolRefusal, WordKey> = {
	input: 'journal.refusal.input',
	dates: 'journal.refusal.dates',
	stale: 'journal.refusal.stale',
	'no-page': 'journal.refusal.no-page',
	'no-entry': 'journal.refusal.no-entry',
	untimed: 'journal.refusal.untimed',
	'no-block': 'journal.refusal.no-block',
	ambiguous: 'journal.refusal.ambiguous',
	'entry-exists': 'journal.refusal.entry-exists',
	future: 'journal.refusal.future',
	heading: 'journal.refusal.heading',
	'date-heading': 'journal.refusal.date-heading',
	rules: 'journal.refusal.rules',
	malformed: 'journal.refusal.malformed',
	'too-big': 'journal.refusal.too-big',
	tool: 'journal.refusal.tool',
	failed: 'journal.problem.failed',
};

/** A refusal: its code, and its sentence filled from `vars` (or `say`'s, when the store worded it already). */
export function refused(code: ToolRefusal, vars: Record<string, string | number> = {}, say: WordKey = REFUSAL_WORDS[code]): ToolResult {
	return { content: [{ type: 'text', text: word(say, vars) }], structuredContent: { refused: code }, isError: true };
}

/** A name the caller gave, cut short enough to say back. */
export const named = (name: string): string => (name.length <= 64 ? name : `${name.slice(0, 63)}…`);

/** A done call: its text, what code reads, and the change line a write names. */
export function done(text: string, structured: unknown, change?: ChangeMeta): ToolResult {
	const result: ToolResult = { content: [{ type: 'text', text }], structuredContent: structured, isError: false };
	if (change !== undefined) result._meta = { [CHANGE_META]: change };
	return result;
}
