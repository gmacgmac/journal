// EVERY SENTENCE THE VIEW SHOWS, BY ITS WORDS KEY (spec § Words, `journal.view.*`). The view's code names keys, never text;
// the text lives in `words/words.json`, the one file the folder ships and the engine reads too.
import { WORDS, fill, type WordKey } from '../../words/words.ts';

type ViewKey<K> = K extends `journal.view.${string}` ? K : never;
export type ViewWord = ViewKey<WordKey>;

/** The words under `key`, each `{name}` filled from `vars`. */
export function say(key: ViewWord, vars: Readonly<Record<string, string | number>> = {}): string {
	return fill(WORDS[key], vars);
}

/** Every key, for the tests. */
export const viewWordKeys = (): ViewWord[] => Object.keys(WORDS).filter((k) => k.startsWith('journal.view.')) as ViewWord[];
