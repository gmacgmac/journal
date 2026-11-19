---
inclusion: always
---

> **Version**: 1.7 | **Updated**: 2026-11-03

One change lifecycle: gates **before** you edit, a record **after** you edit.

## Before editing

| Path | Do this first |
|------|---------------|
| `cortex/PROFILE.md` · `cortex/REGISTRY.md` | Edit → confirm `cortex/readme.md` still describes them accurately |
| Any other `cortex/*`, or `cortex-*`-prefixed files under `.kiro/` (managed — copier-owned) | **Don't.** Overwritten/conflict-marked on next update. Wrong or missing something? Report upstream, don't patch. (Template-repo context only: edit → bump `Version`.) |
| A doc-surface path | `/cortex-docs` — resolve per `router.md § Resolution`, apply its template and naming (kebab-case, 3–4 words), and audit the claims the change made untrue |
| Anything else under `.kiro/` | Edit freely. Never edit `.agent/` or `.claude/` cortex-* files — kernel mirrors. |

**No pre-edit archiving.** Git is the history for everything here. `/cortex-archive` is for
*retiring* content, not for snapshotting a file you are about to change.

Every row above ends in a LOG entry. The doc surface is **declared in `REGISTRY.md` `docs`, not
here** — load it when an edit might touch a doc.

**System files**: anything matching `cortex/*`, `.kiro/steering/cortex-*.md`, or
`.kiro/skills/cortex-*/` is system content — one category, `[cortex-infra]`, always logged.
Discover them by pattern; this file deliberately keeps no inventory.

## Trivial changes

Decide this before you start: does the change need a task file?

**Trivial** = one area (one category, one surface) · no contract change (API, schema, shared
type, public interface) · no decision for the user. All three hold → **no task file**. Any one
fails → plan it in a task (`cortex-write-task`).

Trivial still needs a record:
- a LOG entry with the `Informal change` trail (§ After editing);
- a commit, once the change is verified. Stage the changed files by name. Several trivial changes
  may share one commit; its message names each. The user can say not to commit yet.

## After editing — LOG.md

**When**: a task completes · an informal/ad-hoc change lands · a TODO or decision is deferred ·
**any** documentation change.
**Skip**: exploratory work with no actionable outcome (unless the outcome is a logged TODO).

**How**: append to the end of `cortex/LOG.md`. Chronological, oldest at top. No read first, no
anchors, no `str_replace`.

**Append contract** (this is what makes concurrent writes safe — parallel sub-agents append at the
same moment): one entry is **exactly one line, terminated with `\n`**. Append-only; never
read-modify-write. An unterminated line means the next appender concatenates onto it and two
entries merge into one unparseable row.

```
[[YYYY-MM-DD HH:MM]] [category] Description → <trail>
```

`<trail>` — pick one:

| Work type | Trail |
|-----------|-------|
| Multi-task set | `→ Task: [[cortex-tasks/{concern}/{task-folder}/TASK-STATUS.md]]` |
| Single task | `→ Task: [[cortex-tasks/{concern}/{task-file}.md]]` |
| Informal change | `→ Notes: \`file/path.ext\` (`symbolName`) — brief context` |
| Non-task, non-code | *omit the trail entirely* |

**Who writes it**: the agent that finished the work. In an orchestrated set that means **two levels
of entry, each written once** — the sub-agent logs its own task on completion; the orchestrator logs
the set on completion. The trail target is the discriminator: a task file = one task, `TASK-STATUS.md`
= the set. An N-task set therefore produces N+1 entries; the Gardener coalesces them into one thread
by task folder.

**Anchors**: cite `file.ext` plus the **symbol** (`functionName`, a heading) — never a line number.
Line numbers rot on the next edit, and the Gardener verifies by grepping the symbol.

**Category**: from `PROFILE.md` §2. If several apply, use the most impactful. Deferred items and
open questions → `[needs-human-input]` (the Gardener pauses on these). The concern is *derived*
from the category name's prefix — see PROFILE Conventions; never mapped here.

**Examples**
```
[[2025-12-12 16:00]] [api] Added pagination to products endpoint → Task: [[cortex-tasks/api/2025-12-12_api_pagination/TASK-STATUS.md]]
[[2026-04-16 14:30]] [be-express-api] Fixed polling timeout → Notes: `src/api/polling.js` (`startPoll`) — was 5s, needed 30s
[[2025-12-12 16:30]] [cortex-infra] Updated PROFILE.md
```

> Doc changes are logged so the Gardener can drift-check them against the declared surface. An
> unlogged doc change is an unchecked one.

## AUDITED.md — the Gardener's ledger, nobody else's

`AUDITED.md` records what has been **verified**, and only `cortex-garden` verifies. So only
`cortex-garden` writes to it. Running a skill is not an audit event: no skill, task execution, or
handler appends there — their record is a LOG entry, which the Gardener later promotes.

```
[[PROCESSING_TIME]] [gardener] ✓ [[ORIGINAL_TIME]] [category] Description → Task: [[link]]
```
> The Gardener writes an enriched multi-line form (domain, files changed, docs checked, ripple
> actions, unresolved). That format is owned by the `cortex-garden` skill.

**Cleanup**: the Gardener removes an item from `cortex/LOG.md` once it is recorded in AUDITED.md.
Nothing else removes LOG entries.

> **Source of truth**: `router.md` (resolution) · `PROFILE.md` (vocabulary/switches/categories) ·
> `REGISTRY.md` (paths/docs/handlers).
