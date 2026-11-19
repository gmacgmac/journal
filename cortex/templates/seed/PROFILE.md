# Cortex — Project Profile

> **Seed-once** (yours; never overwritten by updates) · **Resident** (always-in-context).
> The minimum the kernel needs every turn: switches + the category vocabulary + conventions.
> Per-category paths, doc surface, and handlers live in `cortex/REGISTRY.md`, loaded on demand.

---

## §1 Switches

```yaml
system_mode: learning        # learning | production
auto_create_folders: true    # learning mode only (requires approval)
auto_create_categories: true # learning mode only (requires approval)
deep_ripple_scan: true       # ON by default — safety net for an incomplete fence
```

- **learning** — propose new structure via `[needs-human-input]`, wait for approval. New projects.
- **production** — strict; reject content that doesn't fit ("Structural Mismatch").
- **deep_ripple_scan** — when ON, the Gardener also *reads* outside the tracked surface
  (`REGISTRY.md` `docs.include`) to spot affected files. It is **read-only in both modes**: a
  finding can only ever become a proposal to track the path, never an edit. `docs.exclude` is
  never scanned. Turn OFF when the scan is too slow on a large repo, or too noisy — large prose
  or generated trees that aren't documentation.

---

## §2 Categories

The logging vocabulary — the durable nouns every LOG/task/doc is tagged with. Each is a
name + a terse scope. Full paths/docs/handlers for each live in `REGISTRY.md`.

**Permanent (do not remove):**

| Category | Scope |
|----------|-------|
| `cortex-infra` | A **log tag only** for system content (`cortex/`, `.kiro/`) — matched by pattern, never by path. The kernel is not a drift-check target. |
| `needs-human-input` | Items awaiting a decision — resolved via the Collaborative Resolution Protocol |

**Project:**

<!-- INSTALL: discovered by /cortex-setup. One line per category: name + 3–5 word scope. -->

| Category | Scope |
|----------|-------|
<!-- | `{project}-core` | Main application logic | -->
<!-- | `{project}-api` | Endpoints, I/O shapes | -->
<!-- | `{project}-security` | Auth, validation, egress | -->

---

## Conventions

So the hierarchy doesn't have to be written out — it is *derived*:

- **Concern** (task-folder) = the category name's prefix, before the first `-`
  (`{project}-core` → concern `{project}`). Exceptions are declared in `REGISTRY.md`.
- **Subdomain** = the folder a file sits in, under that category's paths. Inferred, never listed.
- **Category of a file** = the **longest / most-specific** path match in `REGISTRY.md`.
- **Doc surface, handlers, per-category paths** → `cortex/REGISTRY.md` (load when routing,
  filing, gardening, or checking the doc fence).

**Task naming** (date-first for chronological sort):
```
cortex-tasks/{concern}/{YYYY-MM-DD}_{category}[_{subdomain}]_{title}.md
cortex-tasks/{concern}/{YYYY-MM-DD}_{category}[_{subdomain}]_{title}/   (multi-task)
```
Date first, category next, subdomain optional, underscore separator, title kebab-case. **Title required.**

> To write a LOG entry you need nothing beyond §2 above. Everything else loads on demand.
