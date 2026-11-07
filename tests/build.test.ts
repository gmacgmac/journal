import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { buildPlugin } from '../bin/build-plugin.ts';
import { MANIFEST, sha256 } from '../bin/sync-markdown.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const PARTS = ['engine/engine.js', 'manifest.json', 'plugin.d.ts', 'skill.md', 'view/journal.css', 'view/journal.js', 'words.json'];

const filesOf = (dir: string): string[] =>
	fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath, e.name))).sort();

describe('the plugin folder', () => {
	let tmp: string;
	let a: string;
	let b: string;
	before(async () => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-build-'));
		a = await buildPlugin({ out: path.join(tmp, 'a') });
		b = await buildPlugin({ out: path.join(tmp, 'b') });
	});
	after(() => fs.rmSync(tmp, { recursive: true, force: true }));

	it('a clean build writes exactly the folder parts', () => {
		assert.deepEqual(filesOf(a), PARTS);
	});

	it('two builds give the same bytes', () => {
		for (const f of PARTS) assert.ok(fs.readFileSync(path.join(a, f)).equals(fs.readFileSync(path.join(b, f))), f);
	});

	it('a build clears what was in the folder before', async () => {
		fs.writeFileSync(path.join(a, 'stale.txt'), 'x');
		await buildPlugin({ out: a });
		assert.deepEqual(filesOf(a), PARTS);
	});

	it('the engine bundle imports only node: modules', () => {
		const text = fs.readFileSync(path.join(a, 'engine/engine.js'), 'utf8');
		const specs = [...text.matchAll(/(?:^|[\s;}])(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)]
			.map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]!);
		for (const s of specs) assert.match(s, /^node:/, `engine imports ${s}`);
	});

	it('the view is one file with no import, exporting only mount', async () => {
		const file = path.join(a, 'view/journal.js');
		const text = fs.readFileSync(file, 'utf8');
		assert.doesNotMatch(text, /^\s*import\b|\bimport\s*\(|\brequire\(/m);
		const mod = await import(`${file}?${Date.now()}`).catch(() => null);
		if (mod) assert.deepEqual(Object.keys(mod), ['mount']);
		else assert.match(text, /export\s*\{\s*\w+ as mount\s*\};?\s*$/);
	});

	it('the manifest names the files the folder holds', () => {
		const m = JSON.parse(fs.readFileSync(path.join(a, 'manifest.json'), 'utf8'));
		assert.ok(fs.existsSync(path.join(a, m.view.module)));
		for (const s of m.view.styles) assert.ok(fs.existsSync(path.join(a, s)));
		assert.ok(fs.existsSync(path.join(a, m.engine.module)));
	});

	it('the folder names no absolute path or user name', () => {
		const user = os.userInfo().username;
		for (const f of PARTS) {
			const text = fs.readFileSync(path.join(a, f), 'utf8');
			assert.ok(!text.includes(ROOT), `${f} names the repo path`);
			assert.ok(!text.includes(os.homedir()), `${f} names the home folder`);
			assert.ok(!text.includes(tmp), `${f} names the output path`);
			assert.ok(!new RegExp(`/(Users|home)/${user}\\b`).test(text), `${f} names the user`);
		}
	});
});

describe('the vendored markdown', () => {
	const dir = path.join(ROOT, 'src/vendor/markdown');
	const sums = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), 'utf8')) as Record<string, string>;

	it('holds exactly the files its manifest lists, each matching its sha256', () => {
		assert.deepEqual(fs.readdirSync(dir).filter((f) => f !== MANIFEST).sort(), Object.keys(sums).sort());
		for (const [f, sum] of Object.entries(sums)) assert.equal(sha256(fs.readFileSync(path.join(dir, f))), sum, f);
	});

	it('holds no test files', () => {
		assert.deepEqual(Object.keys(sums).filter((f) => f.endsWith('.test.ts')), []);
	});
});

describe('the repo', () => {
	it('has no runtime dependency and exact-pinned dev dependencies', () => {
		const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
		assert.equal(pkg.dependencies, undefined);
		for (const v of Object.values(pkg.devDependencies) as string[]) assert.match(v, /^\d+\.\d+\.\d+$/);
	});

	it('ignores node_modules and dist', () => {
		const lines = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n');
		assert.ok(lines.includes('node_modules/') && lines.includes('dist/'));
	});
});
