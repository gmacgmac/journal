// The seam's types: the source of `plugin.d.ts` (bin/types.ts emits it, with no import of any other file).
// PLACEHOLDER: DESIGN_01 defines the contract and JR_02 and JR_03 replace these two shapes.

/** What the host gives `mount`. */
export interface MountContext {
	root: HTMLElement;
}

/** What `mount` hands back. */
export interface Mounted {
	unmount(): void;
}

/** What `createEngine` gives the host. */
export interface Engine {
	tools: { list(): unknown[] };
}
