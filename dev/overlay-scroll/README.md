# nclite's overlay scrollbar, for the dev page only

Copied unchanged from nclite (`app/src/lib/overlay-scroll.ts`, `app/src/lib/overlay-scroll/geometry.ts`,
`app/src/styles/overlay-scroll.css`, at nclite f347a955; only the geometry import path differs), so the dev page scrolls
the way the Journal scrolls inside nclite.

The Journal itself carries none of this. nclite installs the scrollbar once for its whole document
(`routes/+layout.svelte`), so every scroller the Journal draws inside nclite (the paper, the date and Print panels)
already wears it. Building a second one into the plugin would draw two thumbs.
