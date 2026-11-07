/**
 * The tree every consumer renders — the app's Svelte components, the Telegram
 * converter, the streaming tail.
 *
 * THE TREE IS THE INTERFACE, NOT AN HTML STRING. A parser that emitted markup
 * would put escaping decisions in here, where no consumer can see or override
 * them; a tree makes every consumer state its own policy — `{@html}` never
 * appears in the app, and Telegram's entity encoding is a different policy
 * again from HTML's.
 *
 * No Node, no DOM, no imports outside this folder. This folder lifts into
 * another project whole.
 */

/** A run of literal characters. Soft line breaks survive here as `\n`. */
export interface TextInline {
	kind: 'text';
	text: string;
}

/** `` `code` `` — its content is literal, never re-parsed. */
export interface CodeInline {
	kind: 'code';
	text: string;
}

/** A hard break: a line that ended with two spaces or a backslash. */
export interface BreakInline {
	kind: 'break';
}

export interface StrongInline {
	kind: 'strong';
	children: Inline[];
}

export interface EmInline {
	kind: 'em';
	children: Inline[];
}

export interface StrikeInline {
	kind: 'strike';
	children: Inline[];
}

/**
 * `[text](href)`. `href` is exactly what the author wrote — unvalidated, and
 * authored by an untrusted agent. Run it through {@link safeHref} before it
 * reaches an attribute.
 */
export interface LinkInline {
	kind: 'link';
	href: string;
	children: Inline[];
}

/**
 * `![alt](src)`. Kept as its own node so a consumer can *choose*, but the app
 * renders it as a link: fetching an agent-named URL is a data-exfil channel
 * that needs no click.
 */
export interface ImageInline {
	kind: 'image';
	src: string;
	alt: string;
}

export type Inline =
	| TextInline
	| CodeInline
	| BreakInline
	| StrongInline
	| EmInline
	| StrikeInline
	| LinkInline
	| ImageInline;

export interface ParagraphBlock {
	kind: 'paragraph';
	children: Inline[];
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingBlock {
	kind: 'heading';
	level: HeadingLevel;
	children: Inline[];
}

/** A fenced block. `lang` is the first word of the info string, or `null`. */
export interface CodeBlockBlock {
	kind: 'code';
	lang: string | null;
	text: string;
}

export interface BlockquoteBlock {
	kind: 'blockquote';
	children: Block[];
}

/** `checked` is `null` for an ordinary item, `true`/`false` for a task item. */
export interface ListItem {
	checked: boolean | null;
	children: Block[];
}

export interface ListBlock {
	kind: 'list';
	ordered: boolean;
	/** The first item's number. Always 1 for a bullet list. */
	start: number;
	items: ListItem[];
}

/** `null` means the column stated no alignment, which is not the same as left. */
export type ColumnAlign = 'left' | 'center' | 'right' | null;

export interface TableBlock {
	kind: 'table';
	align: ColumnAlign[];
	header: Inline[][];
	rows: Inline[][][];
}

export interface HrBlock {
	kind: 'hr';
}

export type Block =
	| ParagraphBlock
	| HeadingBlock
	| CodeBlockBlock
	| BlockquoteBlock
	| ListBlock
	| TableBlock
	| HrBlock;
