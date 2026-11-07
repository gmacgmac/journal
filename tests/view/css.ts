// Reading a stylesheet as text, for the view's CSS tests: comments out, and the preludes of its top-level rules.

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
