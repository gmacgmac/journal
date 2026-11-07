// The manifest's source. PLACEHOLDER until JR_02 fills the chips and tools (DESIGN_01 defines the shape).
import { SEAM } from './seam.ts';

export function manifestOf(version: string) {
	return {
		id: 'journal',
		name: 'journal.plugin.name',
		version,
		seam: SEAM,
		view: { module: 'view/journal.js', styles: ['view/journal.css'], export: 'mount' },
		engine: { module: 'engine/engine.js', export: 'createEngine' },
		chips: [],
		tools: [],
	};
}
