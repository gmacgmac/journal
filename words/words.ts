// The Journal's words, the one home of every sentence the person or the bot reads (docs/specification/plugin.md § Words).
// The engine (`src/engine/words.ts`) and the view (`src/view/words.ts`) each read their keys from here; the build bundles
// `words.json` into both and ships the same file in the folder, so none of them can differ.
import WORDS from './words.json' with { type: 'json' };

export { WORDS };
export type WordKey = keyof typeof WORDS;

/** `text` with each `{name}` filled from `vars`; a placeholder `vars` lacks is left as it is. */
export function fill(text: string, vars: Readonly<Record<string, string | number>> = {}): string {
	return text.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all));
}
