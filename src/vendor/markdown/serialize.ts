/**
 * THE PARSER, RUN BACKWARDS: a block tree back to Markdown text. A consumer that
 * edits the tree (an editor showing bold as bold, never as `**`) turns it into
 * source with this and nothing else.
 *
 * One promise, tested: `parseMarkdown(blockMarkdown(b))` gives `b` back. Text is
 * escaped only where a character would otherwise mean something, so ordinary
 * writing (`snake_case`, `3.5`, a lone `#`) stays as the person typed it.
 *
 * Pure, with no imports outside this folder.
 */
import type { Block, ColumnAlign, Inline, ListBlock, TableBlock } from './types.ts';

/** Characters that always mean something inline. `_` and `~` are judged in context. */
const ALWAYS = new Set(['\\', '`', '*', '[', ']', '|']);
const WORD = /[\p{L}\p{N}]/u;

function escapeText(text: string): string {
	let out = '';
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i]!;
		const before = text[i - 1] ?? '';
		const after = text[i + 1] ?? '';
		if (ALWAYS.has(ch)) out += `\\${ch}`;
		// `_` only opens or closes at a word's edge, so mid-word it is plain.
		else if (ch === '_' && !(WORD.test(before) && WORD.test(after))) out += '\\_';
		else if (ch === '~' && (before === '~' || after === '~')) out += '\\~';
		else if (ch === '!' && after === '[') out += '\\!';
		else out += ch;
	}
	return out;
}

/** What a line may not start with in a paragraph, or it becomes another block. */
function escapeLineStart(line: string): string {
	const m = /^(\s*)(#{1,6}(?=\s|$)|>|[-+](?=\s|$)|\d{1,9}(?=[.)](?:\s|$))|={3,}|-{3,})/.exec(line);
	if (m === null) return line;
	const lead = m[1]!;
	const rest = line.slice(lead.length);
	// A number keeps its digits and escapes the dot or bracket after them.
	if (/^\d/.test(rest)) {
		const digits = /^\d+/.exec(rest)![0];
		return `${lead}${digits}\\${rest.slice(digits.length)}`;
	}
	return `${lead}\\${rest}`;
}

function codeSpan(text: string): string {
	const runs = text.match(/`+/g) ?? [];
	const fence = '`'.repeat(Math.max(0, ...runs.map((r) => r.length)) + 1);
	const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
	return `${fence}${pad}${text}${pad}${fence}`;
}

/** A link's address, written so the parser reads it back exactly: brackets escaped, `<…>` round spaces. */
function href(url: string): string {
	const escaped = url.replace(/[\\()]/g, '\\$&');
	return /\s/.test(url) && !url.includes('>') ? `<${escaped}>` : escaped;
}

function inline(node: Inline): string {
	switch (node.kind) {
		case 'text': return escapeText(node.text);
		case 'code': return codeSpan(node.text);
		case 'break': return '\\\n';
		case 'strong': return `**${inlines(node.children)}**`;
		case 'em': return `*${inlines(node.children)}*`;
		case 'strike': return `~~${inlines(node.children)}~~`;
		case 'image': return `![${escapeText(node.alt)}](${href(node.src)})`;
		case 'link': {
			const [only] = node.children;
			// A link whose words are its address was written bare; keep it bare.
			if (node.children.length === 1 && only?.kind === 'text' && only.text === node.href && /^https?:\/\/\S+$/.test(node.href)) return node.href;
			return `[${inlines(node.children)}](${href(node.href)})`;
		}
	}
}

const inlines = (nodes: Inline[]): string => nodes.map(inline).join('');

/** Inline nodes as Markdown; soft line breaks stay as newlines. */
export function inlineMarkdown(nodes: Inline[]): string {
	return inlines(nodes).split('\n').map(escapeLineStart).join('\n');
}

const indent = (text: string, by: string): string => text.split('\n').map((l) => (l === '' ? l : by + l)).join('\n');

function listMarkdown(list: ListBlock): string {
	return list.items.map((item, i) => {
		const marker = list.ordered ? `${list.start + i}.` : '-';
		const box = item.checked === null ? '' : item.checked ? '[x] ' : '[ ] ';
		const pad = ' '.repeat(marker.length + 1);
		const parts = item.children.map((child, j) => {
			const text = blockMarkdown(child);
			const prev = item.children[j - 1];
			// A nested list sits right under its line; anything else after a blank line.
			return j === 0 ? text : `${prev !== undefined && child.kind === 'list' ? '\n' : '\n\n'}${text}`;
		}).join('');
		return `${marker} ${box}${indent(parts, pad).slice(pad.length)}`;
	}).join('\n');
}

const ALIGN: Record<string, string> = { left: ':---', center: ':---:', right: '---:' };

/** A table: a cell holds one line, so a break inside it becomes a space. */
function tableMarkdown(table: TableBlock): string {
	const cell = (nodes: Inline[]): string => inlines(nodes).replace(/\\?\n/g, ' ');
	const row = (cells: Inline[][]): string => `| ${cells.map(cell).join(' | ')} |`;
	const rule = table.align.map((a: ColumnAlign) => ALIGN[a ?? ''] ?? '---');
	return [row(table.header), `| ${rule.join(' | ')} |`, ...table.rows.map(row)].join('\n');
}

/** One block as Markdown, with no trailing newline. */
export function blockMarkdown(block: Block): string {
	switch (block.kind) {
		case 'paragraph': return inlineMarkdown(block.children);
		case 'heading': return `${'#'.repeat(block.level)} ${inlineMarkdown(block.children)}`;
		case 'list': return listMarkdown(block);
		case 'blockquote': return block.children.map(blockMarkdown).join('\n\n').split('\n').map((l) => (l === '' ? '>' : `> ${l}`)).join('\n');
		case 'code': {
			const fence = '`'.repeat(Math.max(3, ...(block.text.match(/`{3,}/g) ?? []).map((r) => r.length + 1)));
			return `${fence}${block.lang ?? ''}\n${block.text}\n${fence}`;
		}
		case 'hr': return '---';
		case 'table': return tableMarkdown(block);
	}
}

/** Several blocks, a blank line between each, as a day file separates them. */
export function blocksMarkdown(blocks: Block[]): string {
	return blocks.map(blockMarkdown).join('\n\n');
}
