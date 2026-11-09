// The seam version, the one home of the number. `seam` in manifest.json is `SEAM`. Raised by one for each breaking
// change to the types in `seam-types.ts`, never lowered. nclite's plugin table says which number it is built for.

// 2 (2026-11-09): an entry may have no time (`Edit` entry's `time` is `string | null`), and the tools name an entry by
// its id (`WriteResult.entry`, `ReadDay.entries`).
export const SEAM = 2;
