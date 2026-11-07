// A write under Node's permission model, the way nclite's jail runs the engine (`--permission`, write access to the data
// folder only): Node 24 refuses fsync there, and a save must still land (found by nclite's INT_01 in the real jail).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { dateHeading, dayPath } from '../src/format/index.ts';

const ROOT = resolve(import.meta.dirname, '..');

test('a day is written under the permission model, where fsync is refused', () => {
	const dir = mkdtempSync(join(tmpdir(), 'journal-permission-'));
	const date = '2026-10-01';
	const text = `${dateHeading(date)}\n\n## 09:00\n\nWritten in the jail.\n`;
	const script = `import { writeDay } from ${JSON.stringify(join(ROOT, 'src/store/index.ts'))};\nwriteDay(${JSON.stringify(dir)}, ${JSON.stringify(date)}, ${JSON.stringify(text)});\n`;
	const run = spawnSync(
		process.execPath,
		['--permission', `--allow-fs-read=*`, `--allow-fs-write=${dir}`, '--experimental-strip-types', '--input-type=module', '-e', script],
		{ encoding: 'utf8' },
	);
	assert.equal(run.status, 0, run.stderr);
	assert.equal(readFileSync(join(dir, dayPath(date)), 'utf8'), text);
});
