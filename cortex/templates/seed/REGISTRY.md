# Cortex — Registry

> **Seed-once** (yours; never overwritten) · **On-demand** (NOT resident — load when routing,
> filing, gardening, or checking the doc fence). Renames the old `ROUTES.md`.
> Because it isn't in-context every turn, it can grow without costing per-turn budget.
>
> Four blocks: `categories` (where each category lives), `docs` (the drift fence),
> `handlers` (how to act), `git_worktrees` (how task sets use git worktrees). The resolution
> algorithm itself lives in `router.md § Resolution` — this file is data, not mechanics.

---

## Categories

One DRY record per category. `concern` defaults to the name's prefix (before the first `-`);
declare it only to override. `subdomain` is inferred from the folder a file sits in — never listed.
Classification of a file = the **longest / most-specific** path match below.

```yaml
categories:
  # --- permanent (kernel) ---
  cortex-infra:       { virtual: true }          # a log tag, not a location — never path-matched.
                                                 # System content is discovered BY PATTERN
                                                 # (cortex-change-protocol § System files), so no
                                                 # paths are needed. Giving it paths would hand the
                                                 # Gardener a drift scope over the kernel — whose
                                                 # managed files `copier update` overwrites anyway.
  needs-human-input:  { virtual: true }          # a status, not a location — never path-matched

  # --- project (INSTALL: discovered by /cortex-setup) ---
  # {project}-core:   { paths: [src/, config/] }
  # {project}-api:    { paths: [src/api/, src/routes/] }
  # {project}-ui:     { paths: [web/], concern: {project}-web }   # concern override example
```

---

## Docs (the drift fence)

Three lists. `include` is the **only** list the Gardener may edit. `flag` is drift-checked and
reported, never edited. Everything else it can see, it can only propose on. See `cortex-garden`
SKILL.md § Scope tiers.

Precedence, safest wins: `exclude` > `flag` > `include`, regardless of match specificity.

```yaml
docs:
  # TRACKED — read + fixable. Explicit only: this list is authoritative.
  include:
    - /README.md
    # INSTALL: add authoritative doc folders/files discovered in the scan, e.g.
    # - docs/
    # - CONVENTIONS.md

  # FLAGGED — read + drift-checked + reported as [needs-human-input]; NEVER edited.
  # For protected files: project rules, decision registers, principles.
  flag: []

  # A discovery HINT, not a live matcher. /cortex-setup and the Gardener use it to
  # *propose* additions to `include`; nothing is drift-checked until it is listed above.
  # Rewrite it for the project's shape — the default is code-repo-shaped.
  hint: "README.md files and docs/ folders within any category path"

  # OFF-LIMITS — never drift-checked, never written. Kernel defaults; add project paths.
  exclude: [
    cortex/,                  # kernel + data — never project content
    cortex-tasks/,            # historical record; "fixing" a completed task destroys the audit trail
    "**/cortex-*"              # kernel skills/rules/steering mirrored into .agent/ .claude/ .kiro/ —
                                # matched by PATTERN, not by tree, so a project-specific file sharing
                                # the same folder (e.g. .kiro/steering/{project}-info.md) stays
                                # Observable and driftable
    # INSTALL: add content-not-documentation paths, e.g. `chapters/`, `dist/`, vendored trees
  ]
```

> **`exclude` means "never drift-checked", not "never read."** The Gardener must read
> `cortex/PROFILE.md`, `REGISTRY.md` and `router.md` — they are its own configuration. What it must
> not do is treat them as docs to audit and correct. `cortex/` is excluded wholesale because nothing
> project-specific ever lives there. `.kiro/`, `.agent/`, `.claude/` are **not** excluded wholesale —
> only the `cortex-*`-prefixed files inside them (the kernel's own rules/skills/steering, and their
> generated `.agent/`/`.claude/` mirrors) are, because those are overwritten by `copier update` and a
> fix there silently reverts. Everything else in those trees — project-authored rules, skills, and
> steering — is ordinary project content and stays in scope. `PROFILE`/`REGISTRY` themselves change
> only via the ratification loop (`cortex-garden` engine.md), never a doc-drift fix.

> **`flag` vs `include`**: use `flag` when a change must be coordinated with the developer. Once
> the fence lists every file worth watching, `deep_ripple_scan` can be turned off.

> `cortex/LOG.md` and `cortex/AUDITED.md` are a further exception: the Gardener edits them, but
> **only** via its defined mechanics (remove a processed thread's entries, append a checkpoint).
> Never drift-check or rewrite them.

> **Prose / non-code repos**: the default `hint` finds nothing useful, and declaring the tree
> broadly would swallow the content. Track the authoritative docs (a style guide, an outline,
> a conventions file) and `exclude` the content itself. A chapter is content, not documentation
> *of* something — drift-checking it is a category error.

---

## Handlers (how to act)

Default for any category = the `cortex-garden` drift/ripple check. Add entries only to
override that. System skills match by their own descriptions — do not duplicate them here.

```yaml
handlers:
  # intent -> skill/handler path
  # "process inbound": cortex-route
  # "sync api docs":   handlers/api-doc-sync.md
  # category overrides (run instead of / after the default drift check):
  # {project}-api:     handlers/api-doc-sync.md
```

---

## Git Worktrees (how task sets use them)

Used only when a task set gives a task its own git worktree (TASK-STATUS.md `Own worktree: yes`,
for parallel tasks that write files and run builds or tests). The planner copies these into PLAN.md House Rules; the
orchestrator then works from PLAN.md alone. Empty values → the defaults in `cortex-task-exe`
`references/worktrees.md` (plain `git worktree`, folders beside the repo). Branch and pull-request
policy is not set here; that is the user's or the project's call.

```yaml
git_worktrees:
  # Command that makes a worktree: folder, branch, dependencies, untracked config (e.g. `.env`).
  # Called with two arguments, the worktree name and the commit to start from (the main
  # checkout's HEAD); should print the absolute path and any per-task resources it assigns.
  # Empty → git worktree add <folder> -b <branch> HEAD. A new worktree has no installed
  # dependencies, so a project whose builds or tests need them should set this.
  create_command:

  # Command that removes a worktree and its branch, called with the worktree name.
  # Empty → git worktree remove + git branch -d.
  remove_command:

  # Resources that parallel tasks must not share, and how each task gets its own.
  # e.g. "test port: 3000 + 100 × the task's position in its wave". Empty → none.
  per_task_resources:
```
