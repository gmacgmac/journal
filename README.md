# Journal

A journal for nclite: one note per day, written in place by the person or through tools by the bot.

It is a plugin, built for nclite and vendored into it with nclite's `scripts/plugin-vendor.ts`, which checks out a
commit, runs `npm ci` and `npm run build:plugin -- --out <dir>` here, and keeps the folder that results. Node 24.
There are no runtime dependencies; Vite, TypeScript and `@types/node` are exact-pinned dev dependencies.

## Commands

- `npm run build:plugin [-- --out <dir>]` writes the plugin folder (default `dist/plugin/journal`): `manifest.json`,
  `view/journal.js` and `view/journal.css`, `engine/engine.js`, `words.json`, `skill.md` and `plugin.d.ts`. The same
  input gives the same bytes.
- `npm run dev` runs the Journal on its own at http://127.0.0.1:5193/: the real view and engine over `dev/data/`
  (gitignored, filled from the sample days on the first start; delete it to start again), with switches for its own
  colours or a bot's, light or dark, the page's serif (the faces a Mac has), and a wide or narrow pane (`dev/server.ts`, `dev/host.ts`). Never shipped.
- `npm test` and `npm run check` (`tsc --noEmit`).
- `npm run sync:markdown -- <path to nclite's shared/markdown>` copies nclite's markdown parser into
  `src/vendor/markdown/`, byte for byte, with a `SHA256.json` that nclite's test compares against its own copy.

## Layout

- `src/engine/` the engine (`createEngine`) · `src/view/` the view (`mount`) and `journal.css`
- `src/seam.ts` the seam number · `src/seam-types.ts` the source of `plugin.d.ts`
- `src/vendor/markdown/` the synced copy (never edit by hand) · `skill/` · `words/` · `bin/` · `tests/` · `docs/`
