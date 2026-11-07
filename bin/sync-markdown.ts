// `npm run sync:markdown -- <path to nclite's shared/markdown>`: copies its `*.ts` files (not the tests) into
// `src/vendor/markdown/`, byte for byte, and writes `SHA256.json` (file name -> sha256) beside them. nclite's
// held-equal test compares that manifest, and the files, with its own `shared/markdown/`.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEST = path.resolve(import.meta.dirname, '../src/vendor/markdown');
export const MANIFEST = 'SHA256.json';

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export function syncMarkdown(from: string, to = DEST): Record<string, string> {
	const files = fs.readdirSync(from).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort();
	if (!files.length) throw new Error(`no markdown sources in ${from}`);
	fs.rmSync(to, { recursive: true, force: true });
	fs.mkdirSync(to, { recursive: true });
	const sums: Record<string, string> = {};
	for (const f of files) {
		const bytes = fs.readFileSync(path.join(from, f));
		fs.writeFileSync(path.join(to, f), bytes);
		sums[f] = sha256(bytes);
	}
	fs.writeFileSync(path.join(to, MANIFEST), `${JSON.stringify(sums, null, 2)}\n`);
	return sums;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const from = process.argv[2];
	if (!from) throw new Error('usage: npm run sync:markdown -- <path to nclite shared/markdown>');
	const sums = syncMarkdown(path.resolve(from));
	console.log(`synced ${Object.keys(sums).length} files into src/vendor/markdown`);
}
