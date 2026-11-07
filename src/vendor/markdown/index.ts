/**
 * A chat-dialect markdown parser: string in, typed tree out.
 *
 * Three consumers, one source — the app's renderer, the Telegram converter, and
 * the streaming tail. Nothing in this folder imports from `engine/`,
 * `container/` or `app/`, and nothing here touches Node or the DOM, so the
 * folder lifts into another project whole.
 *
 * THE DIALECT IS THE CONTRACT, and it is smaller than CommonMark on purpose —
 * paragraphs, ATX headings, bold/italic/strike, inline and fenced code, links,
 * lists (nested, with task items), blockquotes, GFM tables, rules, hard breaks,
 * and bare `http(s)://` URLs as links.
 * Setext headings, reference links and footnotes are out; raw HTML is never
 * parsed and reaches the consumer as literal text. Anything unrecognised
 * degrades to paragraph text rather than raising.
 */

export { parseMarkdown, parseMarkdownSpans } from './parse.ts';
export type { SpannedBlock } from './parse.ts';
export { blockMarkdown, blocksMarkdown, inlineMarkdown } from './serialize.ts';
export { repairTail } from './repair.ts';
export { linkify, plainText, safeHref } from './inline.ts';
export type {
	Block,
	BlockquoteBlock,
	BreakInline,
	CodeBlockBlock,
	CodeInline,
	ColumnAlign,
	EmInline,
	HeadingBlock,
	HeadingLevel,
	HrBlock,
	ImageInline,
	Inline,
	LinkInline,
	ListBlock,
	ListItem,
	ParagraphBlock,
	StrikeInline,
	StrongInline,
	TableBlock,
	TextInline,
} from './types.ts';
