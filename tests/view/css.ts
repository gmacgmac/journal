// Reading a stylesheet as text, for the view's CSS tests: comments out, and the preludes of its top-level rules.
import fs from 'node:fs';
import path from 'node:path';

export const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The preludes of the sheet's top-level rules and at-rules, in order. */
export function topLevel(css: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < css.length; i += 1) {
		if (css[i] === '{') {
			if (depth === 0) out.push(css.slice(start, i).trim());
			depth += 1;
		} else if (css[i] === '}') {
			depth -= 1;
			if (depth === 0) start = i + 1;
		}
	}
	return out;
}

const viewDir = path.join(import.meta.dirname, '../../src/view');

/** The whole view stylesheet: `journal.css` with each `@import` replaced, in order, by the part it names, so a test
 *  sees the same rules the build ships however the sheet is divided. */
export function readStylesheet(): string {
	const index = fs.readFileSync(path.join(viewDir, 'journal.css'), 'utf8');
	return index.replace(/@import url\('([^']+)'\);/g, (_m, rel: string) => fs.readFileSync(path.join(viewDir, rel), 'utf8'));
}
