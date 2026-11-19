---
inclusion: always
---

> **Version**: 1.0 | **Updated**: 2026-07-17

## Principles

The tenets that govern how the taxonomy is shaped, named, and grown — so any model touching
this system reasons about structure the same way.

1. **The taxonomy models how you think, not the filesystem.** A category is a noun you'd
   use describing the work aloud (`channels`, `security`). Paths only *detect* a category;
   they are not what it *is*.

2. **A name is a permanent index key.** It tags logs, tasks, and docs forever. Name for the
   durable domain, not today's implementation (`{project}-channels`, never `{project}-telegram`).
   Kebab-case, `{concern}-{domain}`.

3. **One change, one primary category.** If work routinely spans two, the boundary is wrong —
   split or merge. Ties resolve to the most-specific (longest) path match.

4. **The name encodes the hierarchy.** concern = the name's prefix; subdomain = the file's
   folder. Self-describing names mean less to look up.

5. **Right-size granularity.** Enough categories to make drift checks precise, few enough to
   hold in your head (~10–20). A category nothing ever tags is noise; one that catches
   everything is too coarse.

6. **The model proposes; the human ratifies.** Learning mode is the curation loop. The human
   owns the vocabulary; the AI extends it only with approval.

7. **Curate or it decays.** A stale fence gives false confidence. When a new domain of work
   appears, add the category *then* — not later.

8. **Structure serves retrieval.** The point is that future-you — and future, better models —
   can navigate accumulated work fast. Judge every organizing choice by that.
