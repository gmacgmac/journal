/** Character classes and runs the inline scanner and the bare-URL rule share. */

const ASCII_PUNCT = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');

export function isSpace(ch: string | undefined): boolean {
	return ch === undefined || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

export function isPunct(ch: string | undefined): boolean {
	return ch !== undefined && ASCII_PUNCT.has(ch);
}

/** Length of the run of `ch` starting at `from`. */
export function runLength(text: string, from: number, ch: string): number {
	let n = 0;
	while (text[from + n] === ch) n += 1;
	return n;
}
