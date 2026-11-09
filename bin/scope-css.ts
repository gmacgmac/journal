// A Vite plugin that nests a reusable package's stylesheet inside the app's scope: every `.css` file under `dir` is
// wrapped as `<scope> { … }` before it is bundled, so a package written with plain classes (`src/ui/date-pick/`) obeys a
// host's rule that every selector sit under the plugin's own class (nclite's `checkPluginStylesheet`). Used by the build
// (`vite.config.ts`) and the dev page (`dev/server.ts`), so both see the same sheet.
import path from 'node:path';
import type { Plugin } from 'vite';

export function scopeCss(dir: string, scope: string): Plugin {
	const root = path.resolve(dir) + path.sep;
	return {
		name: 'journal-scope-css',
		enforce: 'pre',
		transform(code, id) {
			const file = id.split('?')[0]!;
			if (!file.endsWith('.css') || !path.resolve(file).startsWith(root)) return null;
			return { code: `${scope} {\n${code}\n}\n`, map: null };
		},
	};
}
