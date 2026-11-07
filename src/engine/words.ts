// Every sentence the engine says, by its words key (docs/specification/plugin.md § Words). The text lives in
// `words/words.json`, the file the plugin folder ships, so the bundle and the folder cannot differ.
import type { Problem } from '../format/index.ts';
import { WORDS, fill, type WordKey } from '../../words/words.ts';

export type { WordKey };

/** The sentence under `key`, each `{name}` filled from `vars`. */
export function word(key: WordKey, vars: Readonly<Record<string, string | number>> = {}): string {
	return fill(WORDS[key], vars);
}

const KINDS: Record<string, WordKey> = { code: 'journal.problem.kind.code', table: 'journal.problem.kind.table', hr: 'journal.problem.kind.hr' };

/** A day's problem as the person and the bot read it. */
export function problemText(p: Problem): string {
	switch (p.code) {
		case 'date-line': return word('journal.problem.date-line', { heading: p.heading });
		case 'entry-heading': return word('journal.problem.entry-heading', { text: p.text });
		case 'body-kind': return word('journal.problem.body-kind', { kind: word(KINDS[p.kind] ?? 'journal.problem.kind.other') });
		default: return word(`journal.problem.${p.code}`);
	}
}
