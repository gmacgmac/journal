// The plugin's two bundles (bin/build-plugin.ts runs them): the view for a browser and the engine for Node, each one
// ESM file a host imports by path, with everything it needs inside. The engine imports nothing but `node:` modules.
// Same input, same bytes: no sourcemap, no timestamp, no path of this machine.
import path from 'node:path';
import type { InlineConfig } from 'vite';
import { scopeCss } from './bin/scope-css.ts';

const here = (rel: string) => path.resolve(import.meta.dirname, rel);

/** Browsers the view's sheet is written for: each has `light-dark()`, so the minifier keeps it native. */
export const CSS_TARGET = ['chrome123', 'safari17.5', 'firefox120'];

const common = (outDir: string) => ({
	configFile: false as const, root: here('.'), logLevel: 'warn' as const,
	build: { outDir, emptyOutDir: false, copyPublicDir: false, sourcemap: false, reportCompressedSize: false },
});

/** `view/journal.js` (exports `mount`) and `view/journal.css`, built into `<outDir>/view/`. */
export const viewBuild = (outDir: string): InlineConfig => {
	const base = common(path.join(outDir, 'view'));
	return {
		...base,
		// The reusable packages under src/ui/ write plain classes; the sheet nests them under the Journal's scope.
		plugins: [scopeCss(here('src/ui'), '.journal')],
		build: {
			...base.build, target: 'es2022', cssTarget: CSS_TARGET, cssCodeSplit: false,
			lib: { entry: here('src/view/view.ts'), formats: ['es'], fileName: () => 'journal.js', cssFileName: 'journal' },
			rollupOptions: { output: { codeSplitting: false } },
		},
	};
};

/** `engine/engine.js` (exports `createEngine`), built into `<outDir>/engine/`. */
export const engineBuild = (outDir: string): InlineConfig => {
	const base = common(path.join(outDir, 'engine'));
	return {
		...base, ssr: { noExternal: true },
		build: {
			...base.build, ssr: true, target: 'node24', minify: false,
			lib: { entry: here('src/engine/engine.ts'), formats: ['es'], fileName: () => 'engine.js' },
			rollupOptions: { external: [/^node:/], treeshake: { moduleSideEffects: false }, output: { codeSplitting: false } },
		},
	};
};
