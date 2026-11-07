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
import { autolink } from './inline/autolink.ts';
import type { HostMemo } from './inline/autolink.ts';
import { isPunct, isSpace, runLength } from './inline/chars.ts';
import { backtickRuns, closerTable, findCodeClose } from './inline/pairs.ts';
import type { BacktickRuns } from './inline/pairs.ts';
import { emit, FrameStack } from './inline/tree.ts';

/** How deep a link label may nest before the label is taken literally. */
const MAX_LABEL_DEPTH = 12;

/** The schemes a rendered `href` may carry. Anything else is not a link. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

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

/**
 * Text with its bare URLs as links, and NOTHING ELSE recognised — no
 * emphasis, no code, no `[label](url)`. This is what the user's own bubble
 * renders through: their asterisks stay asterisks, and only what is plainly a
 * URL changes.
 */
export function linkify(text: string): Inline[] {
	const nodes: Inline[] = [];
	const hosts: HostMemo = new Map();
	let from = 0;
	let i = 0;
	while (i < text.length) {
		const found = autolink(text, i, hosts);
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
	const frames = new FrameStack(root);
	let buf = '';
	/** The backtick run that never closed, if any, and what was open then. */
	let danglingCode: string | null = null;
	let openAtCode: string[] = [];
	/** Each opener's closer ({@link closerTable}), built the first time one is needed. */
	let brackets: Int32Array | undefined;
	let parens: Int32Array | undefined;
	let ticks: BacktickRuns | undefined;
	const hosts: HostMemo = new Map();

	const into = (): Inline[] => frames.into();
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

	const close = (index: number): void => {
		flush();
		frames.dissolveAbove(index);
		const frame = frames.pop();
		const parent = frames.into();
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
			// `buf` is flushed at every line end, so it holds this line only, and
			// its trailing blanks are counted back from its end. A regex over the
			// whole paragraph at each line end was quadratic (REVIEW_03 S1).
			let end = buf.length;
			while (end > 0 && (buf[end - 1] === ' ' || buf[end - 1] === '\t')) end -= 1;
			if (buf.length - end >= 2) {
				buf = buf.slice(0, end);
				add({ kind: 'break' });
			} else {
				buf += '\n';
				flush();
			}
			i += 1;
			continue;
		}

		// 3. Code spans, before anything they might contain.
		if (ch === '`') {
			const n = runLength(text, i, '`');
			const end = findCodeClose((ticks ??= backtickRuns(text)), i + n, n);
			if (end === -1) {
				if (danglingCode === null) {
					danglingCode = '`'.repeat(n);
					openAtCode = frames.frames.map((frame) => frame.marker);
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
			const closeBracket = depth < MAX_LABEL_DEPTH ? (brackets ??= closerTable(text, '[', ']'))[openBracket]! : -1;
			if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
				parens ??= closerTable(text, '(', ')');
				const closeParen = parens[closeBracket + 1]!;
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
			const found = autolink(text, i, hosts);
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
				const matched = canClose ? frames.innermost(ch, left) : -1;
				if (matched !== -1) {
					left -= frames.frames[matched]!.len;
					close(matched);
					continue;
				}
				const width = ch === '~' ? 2 : left >= 2 ? 2 : 1;
				if (canOpen && width <= left) {
					flush();
					frames.push({ char: ch, len: width, marker: ch.repeat(width), children: [] });
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
	const pending = frames.frames.map((frame) => frame.marker).reverse();
	frames.dissolveAbove(-1);
	// Everything after an unclosed backtick run belongs inside the code span it
	// will become once closed, so that closer comes first and nothing that
	// opened after it counts.
	return {
		nodes: root,
		open: danglingCode !== null ? [danglingCode, ...openAtCode.reverse()] : pending,
	};
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
