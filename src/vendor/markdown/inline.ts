/**
 * Inline parsing — one left-to-right pass with a delimiter stack.
 *
 * NOT COMMONMARK, ON PURPOSE. CommonMark's emphasis rules (the "delimiter run"
 * algorithm with its rule-of-three) exist to settle inputs a person writes by
 * accident; a chat model emits `**bold**` and `*italic*` and little else. The
 * cost of the last 5% of that spec is most of a parser, so this implements a
 * documented, tested precedence instead:
 *
 * 1. Backslash escapes win over everything — `\*` is a literal asterisk.
 * 2. Code spans win over emphasis and links — the content of `` `a **b` `` is
 *    literal. An UNMATCHED opening run degrades to literal backticks.
 * 3. Links/images bind their label before emphasis inside it is considered.
 *    A bare `http(s)://…` outside a label is a link too, its text being its
 *    href — but not inside a label, which is a link already. It runs to the
 *    next whitespace or `<`, minus trailing punctuation, an unbalanced `)`
 *    and any emphasis marks, so `**https://x**` bolds a link rather than
 *    swallowing the closer. So is `www.` and a dotted host, the href gaining
 *    the `https://` the text lacks; a bare `example.com` is a word, because
 *    so is `notes.final.txt`. `safeHref` still decides at render time.
 * 4. Emphasis closes the innermost matching open delimiter of the same
 *    character whose width fits the closing run. A run of `***` opens strong
 *    then em, and closes them in that order, so `***x***` nests.
 * 5. A delimiter that never closes is literal text — never an error.
 *
 * `_` additionally refuses to open mid-word and to close mid-word, so
 * `snake_case_name` survives; `*` has no such rule, matching what editors do.
 */

import type { Inline } from './types.ts';

/** How deep a link label may nest before the label is taken literally. */
const MAX_LABEL_DEPTH = 12;

const ASCII_PUNCT = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');

/** The schemes a rendered `href` may carry. Anything else is not a link. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * What a bare URL sheds from its end: sentence punctuation, quotes and the
 * emphasis marks — a URL is far more often the end of a sentence or of a
 * `**bold**` run than it is a path ending in `.` or `_`. The backtick is for
 * {@link linkify}, which sees `` `https://x` `` as text. A `)` is separate: it
 * stays when the URL opened it (see {@link autolink}).
 */
const URL_TRAILING = new Set('.,;:!?\'"*_~`');

/** What may follow a `www.` host for the address to continue past it. */
const HOST_TAIL = new Set('/?#');

interface Frame {
	char: string;
	len: number;
	marker: string;
	children: Inline[];
}

/** What a scan found: the tree, plus the closers a partial buffer still owes. */
export interface InlineScan {
	nodes: Inline[];
	/** Closers to append, in order, to make the text parse closed. */
	open: string[];
}

/**
 * `href` if it is safe to put in an attribute, otherwise `null`.
 *
 * The allowlist is by scheme, not by denying `javascript:` — a denylist loses
 * to the next encoding trick, and the set of schemes a chat link legitimately
 * uses is three long. A relative or fragment URL resolves against the app's own
 * origin, so it is allowed; a scheme-relative `//host` is not, because the
 * scheme it inherits is not stated in the text.
 */
export function safeHref(href: string): string | null {
	const raw = href.trim();
	if (raw === '' || raw.startsWith('//')) return null;
	// Control characters are how `java\nscript:` gets past a naive check.
	if (/[\u0000-\u0020\u007f]/.test(raw)) return null;
	const scheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(raw);
	// No scheme at the start means relative or a fragment: it resolves against
	// the app's own origin and cannot become an executable URL.
	if (scheme === null) return raw;
	return SAFE_SCHEMES.includes(scheme[0].toLowerCase()) ? raw : null;
}

/** The visible characters of a tree, with every mark dropped. */
export function plainText(nodes: Inline[]): string {
	let out = '';
	for (const node of nodes) {
		switch (node.kind) {
			case 'text':
			case 'code':
				out += node.text;
				break;
			case 'break':
				out += '\n';
				break;
			case 'image':
				out += node.alt;
				break;
			default:
				out += plainText(node.children);
		}
	}
	return out;
}

/** Append, merging runs of text so the tree has no adjacent text nodes. */
function emit(into: Inline[], node: Inline): void {
	if (node.kind === 'text') {
		if (node.text === '') return;
		const last = into[into.length - 1];
		if (last !== undefined && last.kind === 'text') {
			last.text += node.text;
			return;
		}
	}
	into.push(node);
}

function isSpace(ch: string | undefined): boolean {
	return ch === undefined || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

function isPunct(ch: string | undefined): boolean {
	return ch !== undefined && ASCII_PUNCT.has(ch);
}

/** Length of the run of `ch` starting at `from`. */
function runLength(text: string, from: number, ch: string): number {
	let n = 0;
	while (text[from + n] === ch) n += 1;
	return n;
}

/** Index of the `]` closing the `[` at `open`, or -1. */
function matchBracket(text: string, open: number): number {
	let depth = 0;
	for (let i = open; i < text.length; i += 1) {
		const ch = text[i];
		if (ch === '\\') {
			i += 1;
			continue;
		}
		if (ch === '[') depth += 1;
		else if (ch === ']') {
			depth -= 1;
			if (depth === 0) return i;
		}
	}
	return -1;
}

/**
 * Index of the `)` closing the `(` at `open`, or -1. Depth-counted, so a URL
 * containing a balanced pair — `(https://example.com/a_(b))` — closes where the
 * author meant it to.
 */
function matchParen(text: string, open: number): number {
	let depth = 0;
	for (let i = open; i < text.length; i += 1) {
		const ch = text[i];
		if (ch === '\\') {
			i += 1;
			continue;
		}
		if (ch === '(') depth += 1;
		else if (ch === ')') {
			depth -= 1;
			if (depth === 0) return i;
		}
	}
	return -1;
}

/** The destination out of a link target, with any title dropped. */
function destination(raw: string): string {
	const target = raw.trim();
	if (target.startsWith('<')) {
		const end = target.indexOf('>');
		if (end !== -1) return unescapePunct(target.slice(1, end));
	}
	const split = /\s/.exec(target);
	return unescapePunct(split === null ? target : target.slice(0, split.index));
}

/** `\(` → `(`. Only ASCII punctuation is escapable, so nothing else changes. */
function unescapePunct(text: string): string {
	let out = '';
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i]!;
		const next = text[i + 1];
		if (ch === '\\' && isPunct(next)) {
			out += next;
			i += 1;
		} else out += ch;
	}
	return out;
}

/** A bare URL found in text: where it stops, and what it links to. */
interface Autolink {
	/** The index just past the URL; its text is `text.slice(at, end)`. */
	end: number;
	/** The text, plus the `https://` a `www.` address left out. */
	href: string;
}

/**
 * The bare URL that starts at `at`, or `null` if none does.
 *
 * One rule shared by {@link scanInline} and {@link linkify}, so the two agree
 * on where a URL ends. A URL starts at a word boundary — `nothttps://x` is a
 * word — with `http(s)://` or with `www.` and a host ({@link hostEnd}). The
 * scheme form runs to whitespace or `<`; the `www.` form stops at its host
 * unless {@link HOST_TAIL} continues it, so `www.example.com,` and
 * `www.example.com:8080` both end at the host. The end sheds
 * {@link URL_TRAILING}, and a `)` that no `(` inside the URL opened, so
 * `(https://x/a_(b))` keeps the inner pair and gives the outer one back to
 * the sentence.
 */
function autolink(text: string, at: number): Autolink | null {
	const ch = text[at];
	if (ch !== 'h' && ch !== 'H' && ch !== 'w' && ch !== 'W') return null;
	const before = text[at - 1];
	if (!isSpace(before) && !isPunct(before)) return null;
	const head = text.slice(at, at + 8).toLowerCase();
	const scheme = head.startsWith('https://') ? 8 : head.startsWith('http://') ? 7 : 0;
	// The shortest the URL may be trimmed to: past the scheme, or the host.
	const floor = scheme > 0 ? at + scheme : head.startsWith('www.') ? hostEnd(text, at + 4) : -1;
	if (floor === -1) return null;
	let end = floor;
	if (scheme > 0 || HOST_TAIL.has(text[end] ?? '')) {
		while (end < text.length && !isSpace(text[end]) && text[end] !== '<') end += 1;
	}
	while (end > floor) {
		const last = text[end - 1]!;
		if (URL_TRAILING.has(last)) end -= 1;
		else if (last === ')' && parenDepth(text, at, end) < 0) end -= 1;
		else break;
	}
	// A scheme with nothing after it is text; a host by itself is an address.
	if (scheme > 0 && end === floor) return null;
	const typed = text.slice(at, end);
	return { end, href: scheme > 0 ? typed : `https://${typed}` };
}

/**
 * The index just past the dotted host starting at `from`, or -1 if what is
 * there is not one: labels of letters, digits and `-` (neither first nor
 * last) joined by single dots, at least two of them, the last one letters
 * only and at least two long — the industry grammar, so `www.final.txt` is
 * a host and `www.example.c0m` is not. An empty label has no place in it,
 * so `www.a..b.com` — text that looks like a traversal — never matches, and
 * `www.x` does not either: one label is a word, not a host.
 */
function hostEnd(text: string, from: number): number {
	let end = from;
	let labels = 0;
	let label = '';
	for (;;) {
		let n = 0;
		while (isLabelChar(text[end + n])) n += 1;
		if (n === 0) return -1;
		label = text.slice(end, end + n);
		if (label.startsWith('-') || label.endsWith('-')) return -1;
		labels += 1;
		end += n;
		if (text[end] !== '.' || !isLabelChar(text[end + 1])) break;
		end += 1;
	}
	return labels >= 2 && /^[A-Za-z]{2,}$/.test(label) ? end : -1;
}

function isLabelChar(ch: string | undefined): boolean {
	return ch !== undefined && /^[A-Za-z0-9-]$/.test(ch);
}

/** Opens minus closes in `text[from, to)` — negative means a `)` too many. */
function parenDepth(text: string, from: number, to: number): number {
	let depth = 0;
	for (let i = from; i < to; i += 1) {
		if (text[i] === '(') depth += 1;
		else if (text[i] === ')') depth -= 1;
	}
	return depth;
}

/**
 * Text with its bare URLs as links, and NOTHING ELSE recognised — no
 * emphasis, no code, no `[label](url)`. This is what the user's own bubble
 * renders through: their asterisks stay asterisks, and only what is plainly a
 * URL changes.
 */
export function linkify(text: string): Inline[] {
	const nodes: Inline[] = [];
	let from = 0;
	let i = 0;
	while (i < text.length) {
		const found = autolink(text, i);
		if (found === null) {
			i += 1;
			continue;
		}
		emit(nodes, { kind: 'text', text: text.slice(from, i) });
		nodes.push({ kind: 'link', href: found.href, children: [{ kind: 'text', text: text.slice(i, found.end) }] });
		from = found.end;
		i = found.end;
	}
	emit(nodes, { kind: 'text', text: text.slice(from) });
	return nodes;
}

/** The tree for one block's text. Total: any string parses. */
export function parseInline(text: string, depth = 0): Inline[] {
	return scanInline(text, depth).nodes;
}

/**
 * The tree, plus what a partial buffer still owes — the second half is what
 * {@link repairTail} consumes, which is why the two share one scanner rather
 * than agreeing by eye about what "open" means.
 */
export function scanInline(text: string, depth = 0): InlineScan {
	const root: Inline[] = [];
	const stack: Frame[] = [];
	let buf = '';
	/** The backtick run that never closed, if any, and what was open then. */
	let danglingCode: string | null = null;
	let openAtCode: string[] = [];

	const into = (): Inline[] => stack[stack.length - 1]?.children ?? root;
	const flush = (): void => {
		if (buf !== '') {
			emit(into(), { kind: 'text', text: buf });
			buf = '';
		}
	};
	const add = (node: Inline): void => {
		flush();
		emit(into(), node);
	};

	/** Unwind frames above `keep`, their markers becoming literal text. */
	const dissolveAbove = (keep: number): void => {
		while (stack.length - 1 > keep) {
			const frame = stack.pop()!;
			const parent = stack[stack.length - 1]?.children ?? root;
			emit(parent, { kind: 'text', text: frame.marker });
			for (const child of frame.children) emit(parent, child);
		}
	};

	const close = (index: number): void => {
		flush();
		dissolveAbove(index);
		const frame = stack.pop()!;
		const parent = stack[stack.length - 1]?.children ?? root;
		if (frame.char === '~') emit(parent, { kind: 'strike', children: frame.children });
		else if (frame.len === 2) emit(parent, { kind: 'strong', children: frame.children });
		else emit(parent, { kind: 'em', children: frame.children });
	};

	let i = 0;
	while (i < text.length) {
		const ch = text[i]!;

		// 1. Escapes.
		if (ch === '\\') {
			const next = text[i + 1];
			if (next === '\n') {
				add({ kind: 'break' });
				i += 2;
				continue;
			}
			if (isPunct(next)) {
				buf += next;
				i += 2;
				continue;
			}
			buf += ch;
			i += 1;
			continue;
		}

		// 2. Line ends: two trailing spaces make it hard, otherwise it survives
		//    as a `\n` in the text and the consumer decides how to show it.
		if (ch === '\n') {
			const trimmed = buf.replace(/[ \t]+$/, '');
			if (buf.length - trimmed.length >= 2) {
				buf = trimmed;
				add({ kind: 'break' });
			} else buf += '\n';
			i += 1;
			continue;
		}

		// 3. Code spans, before anything they might contain.
		if (ch === '`') {
			const n = runLength(text, i, '`');
			const end = findCodeClose(text, i + n, n);
			if (end === -1) {
				if (danglingCode === null) {
					danglingCode = '`'.repeat(n);
					openAtCode = stack.map((frame) => frame.marker);
				}
				buf += '`'.repeat(n);
				i += n;
				continue;
			}
			add({ kind: 'code', text: codeSpanText(text.slice(i + n, end)) });
			i = end + n;
			continue;
		}

		// 4. Links and images. The label binds first, then parses as its own
		//    little document, so `[**a**](u)` keeps its bold.
		if (ch === '[' || (ch === '!' && text[i + 1] === '[')) {
			const isImage = ch === '!';
			const openBracket = isImage ? i + 1 : i;
			const closeBracket = depth < MAX_LABEL_DEPTH ? matchBracket(text, openBracket) : -1;
			if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
				const closeParen = matchParen(text, closeBracket + 1);
				if (closeParen !== -1) {
					const label = text.slice(openBracket + 1, closeBracket);
					const href = destination(text.slice(closeBracket + 2, closeParen));
					const children = parseInline(label, depth + 1);
					if (isImage) add({ kind: 'image', src: href, alt: plainText(children) });
					else add({ kind: 'link', href, children });
					i = closeParen + 1;
					continue;
				}
			}
			// A `[` that opens nothing is a `[`. Nothing is appended to close it.
			buf += ch;
			i += 1;
			continue;
		}

		// 5. Bare URLs — only at depth 0, because the one recursive call is a
		//    link label (rule 4), and a link inside a link is not a thing.
		if (depth === 0) {
			const found = autolink(text, i);
			if (found !== null) {
				add({ kind: 'link', href: found.href, children: [{ kind: 'text', text: text.slice(i, found.end) }] });
				i = found.end;
				continue;
			}
		}

		// 6. Emphasis, strong, strike.
		if (ch === '*' || ch === '_' || ch === '~') {
			const n = runLength(text, i, ch);
			const before = text[i - 1];
			const after = text[i + n];
			const canOpen = !isSpace(after) && (ch !== '_' || isSpace(before) || isPunct(before));
			const canClose = !isSpace(before) && (ch !== '_' || isSpace(after) || isPunct(after));
			let left = n;
			while (left > 0) {
				let matched = -1;
				if (canClose) {
					for (let k = stack.length - 1; k >= 0; k -= 1) {
						const frame = stack[k]!;
						if (frame.char === ch && frame.len <= left) {
							matched = k;
							break;
						}
					}
				}
				if (matched !== -1) {
					left -= stack[matched]!.len;
					close(matched);
					continue;
				}
				const width = ch === '~' ? 2 : left >= 2 ? 2 : 1;
				if (canOpen && width <= left) {
					flush();
					stack.push({ char: ch, len: width, marker: ch.repeat(width), children: [] });
					left -= width;
					continue;
				}
				buf += ch.repeat(left);
				left = 0;
			}
			i += n;
			continue;
		}

		buf += ch;
		i += 1;
	}

	flush();
	// Snapshot before unwinding: after `dissolveAbove` the stack is gone.
	const pending = stack.map((frame) => frame.marker).reverse();
	dissolveAbove(-1);
	// Everything after an unclosed backtick run belongs inside the code span it
	// will become once closed, so that closer comes first and nothing that
	// opened after it counts.
	return {
		nodes: root,
		open: danglingCode !== null ? [danglingCode, ...openAtCode.reverse()] : pending,
	};
}

/** Index of the next run of EXACTLY `n` backticks at or after `from`, or -1. */
function findCodeClose(text: string, from: number, n: number): number {
	let i = from;
	while (i < text.length) {
		if (text[i] !== '`') {
			i += 1;
			continue;
		}
		const run = runLength(text, i, '`');
		if (run === n) return i;
		i += run;
	}
	return -1;
}

/**
 * A code span keeps its content verbatim, minus one framing space pair — that
 * pair is what lets `` ` `` be written as `` `` ` `` ``.
 */
function codeSpanText(raw: string): string {
	if (raw.length >= 2 && raw.startsWith(' ') && raw.endsWith(' ') && raw.trim() !== '') {
		return raw.slice(1, -1);
	}
	return raw;
}
