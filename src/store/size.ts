// How big a day and an answer are, as the host measures them: the bytes of their JSON (the contract's `REPLY_LIMITS`).
// A day that fits these limits answers well inside the reply limit, alone or with others; an answer the engine builds is
// still measured before it is sent, and an edit whose answer would not fit is refused before it is written.
import { MAX_DAY_BLOCKS, MAX_DAY_BYTES, MAX_DAY_JSON_BYTES, blocksOf, type SpanBlock } from '../format/index.ts';
import { REPLY_LIMITS } from '../vendor/plugin-host/plugin-host.ts';

/** The bytes `value` takes as JSON. */
export const jsonBytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value) ?? 'null');

/** What one answer may take: the contract's limit, less room for the host's own wrapping of it. */
export const REPLY_BUDGET = REPLY_LIMITS.bytes - 64 * 1024;

/** Whether a day of `text` is small enough to read and to save: its bytes, its blocks, and its text sent as JSON. */
export function dayFits(text: string, blocks: SpanBlock[] = blocksOf(text)): boolean {
	return Buffer.byteLength(text, 'utf8') <= MAX_DAY_BYTES && blocks.length <= MAX_DAY_BLOCKS && jsonBytes(text) <= MAX_DAY_JSON_BYTES;
}
