---
name: cortex-setup
description: "Set up or maintain a Cortex install: detect whether this is a fresh bootstrap or a version upgrade, then run the right path. Fresh (after `copier copy`) → scan the project and fill PROFILE.md + REGISTRY.md. Existing (after `copier update`) → verify the kernel, resolve conflict markers, report deletions, run changelog migrations. Use for 'install cortex', 'bootstrap this project', 'upgrade cortex', 'apply kernel update', 'run copier update'."
---

# Setup

One entry point for standing Cortex up and keeping it current. This skill **detects** which
operation applies, then loads the matching reference and follows it. It never runs both.

- **Fresh install** — the kernel exists but the project-specific config was never generated.
  Discover the project and write the two seed-once files (`PROFILE.md`, `REGISTRY.md`).
- **Upgrade** — the config already exists; a new kernel version is being pulled in.
  Verify the managed surface, resolve conflicts, report deletions, run migrations.

## Recognised triggers

- Install: "install cortex" · "bootstrap this project" · "run project discovery" · "re-scan project"
- Upgrade: "upgrade cortex" · "apply kernel update" · "run copier update" · "upgrade to version X"

## Step 1 — Detect the operation

Inspect `cortex/PROFILE.md`:

| Signal | Operation |
|--------|-----------|
| Missing, empty, or still contains `<!-- INSTALL: -->` markers (§2 unpopulated) | **fresh install** |
| Populated (real project categories in §2, no INSTALL markers) | **upgrade** |

Corroborate only if PROFILE is ambiguous: a populated `cortex/REGISTRY.md` (project category
records, not just the permanent two) also indicates an existing install.

**Honour explicit intent over detection.** If the user clearly said "upgrade" but PROFILE looks
unpopulated (or vice versa), surface the mismatch and ask — do not silently pick. This guards the
footgun of re-running discovery over a curated PROFILE.

## Step 2 — Dispatch

- **Fresh install** → load and follow `references/install.md`.
- **Upgrade** → load and follow `references/upgrade.md`.

Load only the reference for the detected path. Report which path you took before proceeding.
