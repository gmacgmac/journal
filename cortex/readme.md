# Cortex System

> **Version**: 3.4 | **Updated**: 2026-11-03

A structured kernel for AI-augmented development and project management. Designed for Kiro agents operating autonomously across any project.

Cortex provides routing, logging, task management, and documentation workflows — all namespaced with a `cortex-` prefix so system files never collide with your project files.

This file is the authoritative system reference.

---

## Architecture: reflexes resident, references on-demand

Cortex keeps the **always-in-context** layer to the minimum that must fire on a turn where no
skill is active — the *reflexes* — and loads everything else *on demand*.

- **Resident (every turn):** behavioural rules, taxonomy principles, the change-lifecycle reflex
  (pre-edit gates + the logging format, which needs the category names), and the switches. Small
  and stable.
- **On-demand (loaded when a skill or reflex needs it):** `REGISTRY.md` (per-category paths,
  doc surface, handlers), `router.md` (resolution mechanics), and skill bodies.

**The principle: Declare the fence. Discover the flock.** The fence is the vocabulary +
switches (resident) plus the paths/docs (in REGISTRY); the flock is the files inside it,
discovered at runtime.

### Kernel vs config

1. **The kernel** — universal, identical in every project (rules, router, the Gardener, skills).
   It adapts by *reading* the config, never by being configured with project specifics.
2. **The config** — two seed-once files: `PROFILE.md` (resident: switches + category vocabulary
   + conventions) and `REGISTRY.md` (on-demand: per-category records, doc surface, handlers).
   Both are populated at install (`/cortex-setup`) and owned by the human thereafter.

---

## Content Types

| Type | Location | Behaviour |
|------|----------|-----------|
| **Rules** (always-on) | `.kiro/steering/` (rule + principles content inline; `cortex-profile` links `PROFILE.md`) | Loaded every turn. Small, stable. |
| **Skills** (on-demand) | `.kiro/skills/cortex-*/` | Name + description always available; body loads on activation. |

---

## Rules (always-in-context)

Five steering files in `.kiro/steering/` are always loaded:

| Steering file | Content | Role |
|------------------|--------|------|
| `cortex-rules.md` | self-contained | Core directives, confirmation protocol, supply-chain security |
| `cortex-change-protocol.md` | self-contained | The change lifecycle: pre-edit gates (versioning, naming, placement) + LOG/AUDITED format and triggers |
| `cortex-routing.md` | self-contained | Keyword triggers + pointer to `router.md § Resolution` |
| `cortex-profile.md` | links `PROFILE.md` | Switches + category vocabulary + conventions |
| `cortex-principles.md` | self-contained | Taxonomy/naming tenets |

The rule and principles files live **directly** in `.kiro/steering/` (there is no separate
`cortex/rules/`). Only `cortex-profile` links out via `#[[file:cortex/PROFILE.md]]` — because
`PROFILE.md` is seed-once (user-owned) and must stay UPPERCASE in `cortex/`. `PRINCIPLES` is
kernel content, never user-edited, so it is inlined like the rules rather than linked.
`router.md` and `REGISTRY.md` are **not** resident — they load on demand.

---

## Skills (on-demand)

Twelve skills under `.kiro/skills/`, each a self-contained folder with a `SKILL.md`. Only the
`name` + `description` are always available; the body loads when the skill activates.

| Skill | Role |
|-------|------|
| `cortex-route` | Explicit routing: classify an item, resolve the handler per `router.md § Resolution` |
| `cortex-garden` | The Gardener: coalesce LOG entries into threads, verify changes, fix doc-drift inside the tracked surface, report it in flagged files (read-only outside both) |
| `cortex-docs` | Write and file docs in the doc surface, and keep them true: every claim about code held by a symbol and a named test |
| `cortex-architecture` | How code is organized: reuse, one job per file, one source per contract (schema → code → OpenAPI → MCP), one interface per concern, registries for dependencies, conditions and jobs, one home per sentence (words files) |
| `cortex-archive` | Retire or supersede content into `.archive/` |
| `cortex-search` | Layered search across the doc surface and project |
| `cortex-write-task` | Create task files (single or multi-file) from templates |
| `cortex-task-exe` | Execute tasks: single, sequential, or parallel modes; commits checked work; runs git worktrees when the plan asks |
| `cortex-research` | Deep research with methodology and source tracking |
| `cortex-task-audit` | Audit task files for completeness, staleness, and status accuracy |
| `cortex-word-review` | A local review page where the user approves many sentences or decisions at once (accept, write their own, or ask), before text is implemented |
| `cortex-setup` | Install or upgrade Cortex: detects fresh-vs-existing, then bootstraps (PROFILE + REGISTRY) or runs the kernel upgrade + migrations |

---

## Always-in-context budget

| Component | Count | Size (bytes) | ~Tokens |
|-----------|-------|-------------|---------|
| Steering (5 files inline: rules, change-protocol, routing, profile, principles) | 5 files | ~14,381 | ~3,595 |
| `PROFILE.md` (resolved by the `cortex-profile` link) | 1 | ~3,097 | ~774 |
| Skill descriptions (name + description × 12) | 12 | ~4,220 | ~1,055 |
| **Total always-in-context** | **18** | **~21,698** | **~5,425** |

**On-demand (NOT resident):** `router.md`, `REGISTRY.md`, and every skill *body* — loaded only
when a skill or reflex needs them. Token estimate uses ~4 chars/token. A project's resident cost
grows only with its §2 category list, not with its paths/docs (those live in REGISTRY).

---

## Data Files

| Path | Purpose | Class |
|------|---------|-------|
| `LOG.md` | Append-only work log. | Data |
| `AUDITED.md` | Processing checkpoints (the Gardener writes here). | Data |
| `INBOX/` | Drop zone for inbound material. | Data |
| `.archive/` | Retired and superseded content. Not pre-edit snapshots — git covers those. | Data |

---

## Config (seed-once)

| Path | Purpose | Loaded |
|------|---------|--------|
| `PROFILE.md` | Switches (§1) + category vocabulary (§2, name + terse scope) + conventions. | Resident |
| `REGISTRY.md` | Per-category records (paths, concern overrides), the doc surface, handlers, git worktree settings for task sets. Renames the old `ROUTES.md`. | On-demand |

The **conventions** (in PROFILE) derive the rest: concern = the category name's prefix;
subdomain = the folder a file sits in; a file's category = the longest path match in REGISTRY.

---

## Router (on-demand)

`router.md` (managed) is loaded when something must be routed. It owns:
1. **`§ Resolution`** — the single canonical classify → override → default → fallback algorithm.
   Every consumer points here; none restate it.
2. **Safety routes** — deterministic (e.g. retiring content → archive first).
3. **Collaborative Resolution Protocol** — the unknown-item fallback.

Per-category data + handler links live in `REGISTRY.md`. User-facing intents are matched by
skill descriptions, not enumerated in the router.

---

## Copier Distribution Model

Every file inside `cortex/` belongs to one class, signalled by filename case:

| Case | Class | Copier behaviour |
|------|-------|-----------------|
| `lowercase` | **Managed** (kernel) | Overwritten on every `copier update`. Read-only to consumers. |
| `UPPERCASE` | **Seed-once** (config) | Rendered once via `_skip_if_exists`. Never touched again. |
| `UPPERCASE` / dot-folders | **Data** (runtime state) | Never touched. |

**The rule: lowercase = the system's (overwritten); UPPERCASE = yours (never overwritten).**

### macOS case-collision rule
Inside `cortex/`, no two files may share a stem differing only by case. macOS's
case-insensitive filesystem would silently collide them.

### The `.agent/` mirror
`.kiro/` (Kiro's adaptation layer) can be mirrored to `.agent/` for other tools. That mirror is
maintained **locally** (e.g. a git pre-commit hook in this template repo) and is **not** shipped
by copier — a consumer that wants it sets up its own mirror. `.kiro`/`.agent` are generated:
changes are logged `[cortex-infra]` but not archived (git is their history).

---

## How It Works

1. Work happens → the agent logs it to `LOG.md` (triggers in `.kiro/steering/cortex-change-protocol.md`; category from PROFILE §2, resident).
2. The Gardener (`cortex-garden`) reads `LOG.md`, coalesces entries into threads, checks switches (PROFILE §1), and checks doc-drift against three lists in `REGISTRY.md` `docs`: `include` (tracked — fixed in place), `flag` (protected — drift reported as `[needs-human-input]`, never edited), and `exclude` (never checked). Outside those, `deep_ripple_scan` reads only and proposes.
3. Each ripple is resolved per `router.md § Resolution` to its handler (a skill, or a handler linked in `REGISTRY.md`).
4. Processed items are checkpointed in `AUDITED.md`.

---

## Cortex Modes

Configured via `system_mode` in PROFILE §1:
- **Learning Mode** — new projects. Proposes structure via collaborative resolution, waits for approval.
- **Production Mode** — strict enforcement. Rejects content that doesn't fit ("Structural Mismatch").

---

## Key Concepts

- **Reflexes resident, references on-demand** — only what must fire skill-less stays in context.
- **Kernel vs config** — universal engine vs seed-once PROFILE + REGISTRY.
- **Declare the fence, discover the flock** — declare vocabulary/paths; discover contents at runtime.
- **One resolution algorithm** — `router.md § Resolution`; consumers hold pointers, not copies.
- **Conventions derive structure** — concern = name prefix; subdomain = folder; category = longest path match.
- **Principles govern the taxonomy** — see `PRINCIPLES.md`; the model proposes, the human ratifies.
- **Collaborative Resolution** — `[needs-human-input]` is a recorded outcome, not a wall.

---

## File Layout

```
cortex/
├── readme.md              # managed — this file
├── changelog.md           # managed — version history, Synced/Migrations format
├── router.md              # managed — ON-DEMAND — dispatch mechanics + § Resolution
├── templates/             # managed — doc/handler/tracker/task templates
├── PROFILE.md             # SEED-ONCE — RESIDENT — switches + vocabulary + conventions
├── REGISTRY.md            # SEED-ONCE — ON-DEMAND — paths, doc surface, handlers
├── LOG.md                 # DATA — append-only work log
├── AUDITED.md             # DATA — processing checkpoints
├── INBOX/                 # DATA — drop zone
└── .archive/              # DATA — retired / superseded content
```

---

## Bootstrap

The kernel is non-functional until `PROFILE.md` + `REGISTRY.md` are populated. Run
`/cortex-setup` to scan the project and generate them (it detects a fresh install automatically).
