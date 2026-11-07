// `npm run sync:nclite -- <nclite checkout>`: copies the nclite files this repo carries, byte for byte, and writes a
// `SHA256.json` (file name -> sha256) beside each copy. The copies: nclite's `shared/markdown/*.ts` (not the tests) into
// `src/vendor/markdown/`, and `shared/plugin-host.ts` (the contract) into `src/vendor/plugin-host/`. The build turns the
// manifests into `vendored.json`, which nclite's test compares with its own files.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
export const MANIFEST = 'SHA256.json';

/** A folder of nclite files: its place here, its place in nclite, and the files taken from it. */
export interface Copy {
	/** The folder in this repo, relative to the repo root. */
	dest: string;
	/** The nclite path the files are named by in `vendored.json`: a folder (`shared/markdown`) or a file. */
	source: string;
	/** Which of the files in `source` are copied; `null` for a single-file source. */
	take: ((name: string) => boolean) | null;
}

export const COPIES: Copy[] = [
	{ dest: 'src/vendor/markdown', source: 'shared/markdown', take: (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') },
	{ dest: 'src/vendor/plugin-host', source: 'shared/plugin-host.ts', take: null },
];

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Copy one `Copy` from the nclite checkout `from`; returns file name -> sha256. */
export function syncCopy(copy: Copy, from: string, root = ROOT): Record<string, string> {
	const src = path.join(from, copy.source);
	const dir = copy.take ? src : path.dirname(src);
	const names = copy.take ? fs.readdirSync(dir).filter(copy.take).sort() : [path.basename(src)];
	if (!names.length) throw new Error(`no sources in ${src}`);
	const to = path.join(root, copy.dest);
	const files = names.map((name) => [name, fs.readFileSync(path.join(dir, name))] as const);
	fs.rmSync(to, { recursive: true, force: true });
	fs.mkdirSync(to, { recursive: true });
	const sums: Record<string, string> = {};
	for (const [name, bytes] of files) {
		fs.writeFileSync(path.join(to, name), bytes);
		sums[name] = sha256(bytes);
	}
	fs.writeFileSync(path.join(to, MANIFEST), `${JSON.stringify(sums, null, 2)}\n`);
	return sums;
}

/** The nclite path of each copied file, with its sha256, read from the manifests: the content of `vendored.json`. */
export function vendoredOf(root = ROOT): Record<string, string> {
	const all: Record<string, string> = {};
	for (const copy of COPIES) {
		const sums = JSON.parse(fs.readFileSync(path.join(root, copy.dest, MANIFEST), 'utf8')) as Record<string, string>;
		for (const [name, sum] of Object.entries(sums)) all[copy.take ? `${copy.source}/${name}` : copy.source] = sum;
	}
	return Object.fromEntries(Object.entries(all).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const from = process.argv[2];
	if (!from) throw new Error('usage: npm run sync:nclite -- <nclite checkout>');
	for (const copy of COPIES) {
		const sums = syncCopy(copy, path.resolve(from));
		console.log(`synced ${Object.keys(sums).length} files into ${copy.dest}`);
	}
}
