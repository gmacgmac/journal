// The sample journal (28 September to 9 October 2026, the proof's), for the tests only: never shipped. Every test that
// writes works on a private copy.
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dateOfPath } from '../../src/format/index.ts';

export const DAYS = join(import.meta.dirname, 'days');

/** Every sample day file as [date, text], in date order. */
export function sampleDays(): [string, string][] {
	return (readdirSync(DAYS, { recursive: true }) as string[])
		.filter((rel) => dateOfPath(rel) !== null)
		.sort()
		.map((rel) => [dateOfPath(rel)!, readFileSync(join(DAYS, rel), 'utf8')]);
}

/** A private copy of the sample days (or an empty folder), removed by `done`. */
export function scratch(empty = false): { dir: string; done: () => void } {
	const dir = mkdtempSync(join(tmpdir(), 'journal-test-'));
	if (!empty) cpSync(DAYS, dir, { recursive: true });
	return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}
