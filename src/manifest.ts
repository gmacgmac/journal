// The manifest's source, written to `manifest.json` by `bin/build-plugin.ts` (docs/specification/plugin.md § The manifest).
// Text is a words key, never the text; a tool's `input` is its schema exactly as `tools.list()` gives it.
import type { PluginManifest } from './vendor/plugin-host/plugin-host.ts';
import { toolDecls } from './engine/tools/schemas.ts';
import { SEAM } from './seam.ts';

/** The plugin's id: the manifest's, and the one every chip the view makes carries. */
export const PLUGIN_ID = 'journal';

/** The words of the change line each kind of write names (docs/specification/plugin.md § Tools, What a write gives). */
export const CHANGE_WORDS = ['journal.change.entry', 'journal.change.replace', 'journal.change.delete', 'journal.change.insert'];

export function manifestOf(version: string): PluginManifest {
	return {
		id: PLUGIN_ID,
		name: 'journal.plugin.name',
		version,
		seam: SEAM,
		icon: 'journal',
		view: { module: 'view/journal.js', styles: ['view/journal.css'], export: 'mount' },
		engine: { module: 'engine/engine.js', export: 'createEngine' },
		chips: [
			{ kind: 'block', words: 'journal.plugin.chips.block' },
			{ kind: 'days', words: 'journal.plugin.chips.days' },
		],
		tools: toolDecls(),
		skill: 'skill.md',
		words: 'words.json',
		changeWords: CHANGE_WORDS,
	};
}
