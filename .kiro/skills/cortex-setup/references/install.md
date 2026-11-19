# Install (fresh bootstrap)

Reached from `cortex-setup` when `PROFILE.md` is unpopulated. Turns the generic Cortex kernel
into a project-specific install. The kernel is universal; this path discovers the project and
writes the two seed-once files: `PROFILE.md` (resident vocabulary) and `REGISTRY.md` (on-demand
detail).

## What this path does

1. Scans the project to discover its domains of work and where they live.
2. Writes `cortex/PROFILE.md` — §1 switches + §2 category names (each with a terse scope) + conventions.
3. Writes `cortex/REGISTRY.md` — one record per category (paths, concern overrides), the doc surface, handlers.

It writes **only** seed-once files. It never edits managed (lowercase) files.

## Steps

### 1. Target

Confirm the project root (`$PROJECT_ROOT`). Default: cwd.

### 2. Deep scan

Scan depth 2–3 from `$PROJECT_ROOT`:

| What to find | Feeds |
|--------------|-------|
| Functional domains (source dirs, top-level areas) | Categories (§2 names + REGISTRY paths) |
| Manifests (`package.json`, `pyproject.toml`, `Cargo.toml`) | Category scopes |
| Doc folders (`README.md`, `docs/`, `spec/`) | REGISTRY `docs` (the doc surface) |
| Auth/RBAC/credentials/egress code | Recommend a `{project}-security` category |
| Existing `.kiro/`, `cortex/` | Conflict check |

Report findings before writing.

### 3. Conflict check

Check for pre-existing `cortex-`-prefixed files not placed by copier. Ask how to resolve (skip / replace / abort).

### 4. Write PROFILE.md (resident vocabulary)

- **§1 Switches** — `system_mode: learning` for new projects; `deep_ripple_scan: true`. Keep the
  `auto_create_*` defaults unless the user asks otherwise.
- **§2 Categories** — the **2 permanent** rows (`cortex-infra`, `needs-human-input`) plus one row
  per discovered project domain: `{project}-{domain}` + a **terse 3–5 word scope**. Name for the
  durable domain, not the implementation (see `.kiro/steering/cortex-principles.md`).
- **Conventions** — leave the block as shipped (concern = name prefix; subdomain = folder; longest
  path match). Only note exceptions the project forces.

Present the proposed PROFILE for confirmation, then write it.

### 5. Write REGISTRY.md (on-demand detail)

- **`categories`** — one YAML record per project category: `{ paths: [...] }`. Add a `concern:`
  override **only** when the name's prefix isn't the right task-folder (e.g. a sub-app with its own
  concern). Leave both permanent rows as shipped — `cortex-infra` and `needs-human-input` are
  `{ virtual: true }`; **never give `cortex-infra` paths**, or the Gardener inherits a drift scope
  over the kernel. System content is matched by pattern instead (`cortex-change-protocol`).
- **`docs`** — four keys. `include`: the authoritative docs discovered in the scan (this list is
  the *only* thing the Gardener may fix). `flag`: protected files — anything a project rule
  forbids agents to edit (project steering, decision register, principles); drift-checked and
  reported, never edited. `hint`: reword for the project's shape — the shipped default assumes a
  code repo. `exclude`: keep the kernel defaults and add any content-not-documentation paths
  found (a manuscript, generated output, vendored trees).
- **`handlers`** — leave mostly empty; add intent→skill or category overrides only where a real
  handler exists. Default for every category is the `cortex-garden` drift check.
- **`git_worktrees`** — fill `create_command` / `remove_command` only if the project has its own
  worktree script (look in the manifest's scripts), and `per_task_resources` only if parallel
  tasks would clash (test ports, databases). Otherwise leave them empty.

Present the seeded REGISTRY for confirmation, then write it.

### 6. Verify

- [ ] `PROFILE.md` §2 populated (2 permanent + project categories, each with a scope); no placeholders.
- [ ] `REGISTRY.md` has a `categories` record for every §2 category; `docs` non-empty.
- [ ] Every category path exists on disk; concern overrides point at real task-folder names.
- [ ] `needs-human-input` is `virtual`; not given paths.
- [ ] No `<!-- INSTALL: -->` markers remain.

Report a summary. Tell the user: once `include` + `flag` list every file worth watching, turn
`deep_ripple_scan` off — the explicit fence replaces the slow, noisy scan.

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| §2 categories empty | Re-run step 2 (scan may have missed source dirs) |
| REGISTRY paths don't exist | Verify on disk; remove or correct |
| A category's prefix isn't its task-folder | Add a `concern:` override in REGISTRY |
| Doc surface paths don't exist | Remove non-existent ones from `docs` |
