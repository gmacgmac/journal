// The manifest's source, written to `manifest.json` by `bin/build-plugin.ts` (docs/specification/plugin.md § The manifest).
// Text is a words key, never the text. The tools and their `changeWords` are JR_05's.
import type { PluginManifest } from './vendor/plugin-host/plugin-host.ts';
import { SEAM } from './seam.ts';

export function manifestOf(version: string): PluginManifest {
	return {
		id: 'journal',
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
		tools: [],
		skill: 'skill.md',
		words: 'words.json',
	};
}
