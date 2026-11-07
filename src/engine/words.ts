// Every sentence the engine's core says, by its final words key (docs/specification/plugin.md § Words).
// DRAFT HOME until JR_05: these move to `words/words.json` under the same keys, byte for byte, and `word` then reads that
// file. The keys are final, so no caller changes when they move. Most sentences are the proof's own.
import type { Problem } from '../format/index.ts';

const WORDS = {
	'journal.problem.dates-form': 'Dates must be YYYY-MM-DD.',
	'journal.problem.dates-range': 'A range runs forwards, at most {max} days.',
	'journal.problem.caller': 'Only the person can use this.',
	'journal.problem.method': 'This part of the journal doesn’t take that request.',
	'journal.problem.failed': 'The journal couldn’t read or save this day. Try again.',
	'journal.problem.unreadable': 'The edit could not be read.',
	'journal.problem.empty': 'There is nothing to add.',
	'journal.problem.entry-time': 'An entry needs a time like 21:30 and a one-line title.',
	'journal.problem.changed': 'This part of the page changed after you opened it, so your edit was not saved.',
	'journal.problem.undo-changed': 'This part has changed since, so it can’t be undone.',
	'journal.problem.no-page': 'This day’s page no longer exists.',
	'journal.problem.date-heading': 'The date comes from the page itself and can’t be edited.',
	'journal.problem.heading': 'Writing can’t add a heading. To start a new entry, use Add an entry.',
	'journal.problem.entry-heading-form': 'An entry’s heading is a time, then an optional title.',
	'journal.problem.entry-exists': 'There is already an entry at {time}. Add to that one, or pick another time.',
	'journal.problem.malformed': 'This page breaks the journal’s rules, so it can’t be changed here. Fix the file itself first.',
	'journal.problem.too-big': 'This page is over {max} KB, too big to open here.',
	'journal.problem.would-be-too-big': 'That would make this page over {max} KB, too big to save.',
	'journal.problem.not-a-file': 'This page isn’t a plain file, so it can’t be read.',
	'journal.problem.line-ends': 'Lines must end with a plain newline.',
	'journal.problem.html': 'A journal page can’t hold HTML.',
	'journal.problem.date-line': 'The page must start with “{heading}”.',
	'journal.problem.entry-heading': '“{text}” isn’t an entry heading; it must be “## HH:MM” or “## HH:MM · Title”.',
	'journal.problem.outside-entry': 'Writing must sit under an entry’s time.',
	'journal.problem.body-kind': 'An entry holds paragraphs, lists and quotes, not {kind}.',
	'journal.problem.kind.code': 'a code block',
	'journal.problem.kind.table': 'a table',
	'journal.problem.kind.hr': 'a rule',
	'journal.problem.kind.other': 'that kind of block',
	'journal.chip.where-block': 'Journal, {title}, {entry}',
	'journal.chip.where-day': 'Journal, {title}',
	'journal.chip.where-days': 'Journal, {from} to {to}',
	'journal.chip.gone': 'This part of the journal changed or went, so it can’t be sent.',
	'journal.chip.too-long': 'That is more of the journal than one message can carry. Pick fewer days.',
} as const;

export type WordKey = keyof typeof WORDS;

/** The sentence under `key`, each `{name}` filled from `vars`. */
export function word(key: WordKey, vars: Readonly<Record<string, string | number>> = {}): string {
	return WORDS[key].replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all));
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
