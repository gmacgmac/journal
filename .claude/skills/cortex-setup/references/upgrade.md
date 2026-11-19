# Upgrade (kernel version bump)

Reached from `cortex-setup` when `PROFILE.md` is already populated. Applies a new Cortex kernel
version safely. Wraps `copier update` with verification that catches the two dangerous failure
modes: silent conflict markers in always-loaded files, and undocumented managed-file removals.

## Steps

### 0. Preflight

Two cheap checks before touching anything — both catch failure modes that otherwise only surface
mid-update.

**a) Is there actually a new version?** Read `_src_path` from `.copier-answers.yml` (falls back to
`gh:gmacgmac/cortex` if unset) and compare against the latest upstream tag:

```bash
git ls-remote --tags https://github.com/gmacgmac/cortex.git 2>&1 \
  | grep -oE 'v[0-9]+\.[0-9]+(\.[0-9]+)?' | sort -V | tail -1
```

Compare the result to the local `_commit` in `.copier-answers.yml`. Equal → report "Already at
latest (vX). No action needed" and **stop here** — do not run `copier update`. This is the
authoritative check; don't infer "already updated" from what the working tree looks like.

**b) Is the tree clean?** `git status --porcelain`. Non-empty → **stop and ask** the user to
commit, stash, or abort before proceeding — `copier update` refuses to run on a dirty tree, and
finding that out from the failure is a wasted step.

### 1. Run copier update

Record the **old** template version first, from git: `git show HEAD:.copier-answers.yml` (the
last-committed `_commit`) — never from the working-tree file, which may already reflect a
`copier update` the user ran manually before invoking this skill.

```bash
copier update --trust --defaults
```

Pin: `copier==9.16.0` minimum. If the user has a different version, warn but proceed. Safe to run
even if the user already ran it — a no-op when already current (step 0a should already have
caught that case, but this is not destructive either way).

`--defaults` is required for agent-driven runs: without it, a new or changed prompt opens an
interactive TTY read (`prompt_toolkit`) that has no terminal to read from in a non-interactive
session and crashes (`OSError: [Errno 22] Invalid argument`). Accepting defaults is safe here
because `copier.yml` only asks cosmetic questions with sane defaults — but note any newly-added
question and its accepted default in the outcome report (step 6), so a silent default doesn't
slip past the human unnoticed.

Record the **new** version from `.copier-answers.yml` after this step.

### 2. Conflict-marker sweep

Grep the managed surface for git-style conflict markers:

**Search patterns**: `<<<<<<<`, `=======`, `>>>>>>>`

**Target paths** (managed; steering/rules are always-loaded = poison if conflicted):
- `.kiro/steering/` (all files)
- `cortex/router.md`
- `cortex/readme.md`
- `cortex/changelog.md`
- `cortex/templates/` (all files)

**If found**: a conflict marker in any always-loaded steering file is **poison** — the system will malfunction until resolved. Force resolution:
1. Present the conflict (both sides).
2. Recommend keeping the incoming (template) version for managed files (copier owns them).
3. Apply the resolution. Do NOT leave markers in place.

### 3. Deletion/rename report

Diff the managed surface pre- vs post-update:

- **Deleted files**: any managed file that existed before but is gone after update. Report each with its old path.
- **Renamed files**: any managed file whose content moved to a new path. Report old → new.
- **Why this matters**: a consumer who "adopted" a managed file by adding local edits can lose work silently if copier removes it.

Present the report. If deletions occurred, ask the user to confirm they're acceptable.

### 4. Reconcile seed-once files against current schema

`cortex/templates/seed/PROFILE.md` and `REGISTRY.md` are **Managed** — step 1's `copier update`
just refreshed them to the kernel's current schema. They are never the live files; they exist
only as an upgrade-diff reference. Diff each against the consumer's live, customized
`cortex/PROFILE.md` / `REGISTRY.md`, **structurally** (keys, sections, YAML fields) — never by
overwriting values:

- Field/section present in the seed but missing from the live file → add it in place with the
  seed's default.
- Renamed field (e.g. a YAML key renamed) → rename in place in the live file, **preserving the
  consumer's existing value**.
- Kernel-authored prose changed (switch descriptions, doc-fence explanation) → adopt the new
  wording for kernel-authored blocks only.
- Never touch consumer content: categories, paths, hints, excludes, or values the consumer added
  or edited. This is a schema sync, not a template overwrite.

This does not depend on which version the consumer is upgrading from — it's a diff against one
target, not a replay of version history.

### 5. Execute Migrations (structural/data actions only)

Read `cortex/changelog.md`. Find entries between the old version and the new version. This step
now covers only what a schema diff can't express — renaming/moving/deleting a **data** file or
folder (`cortex/LOG.md`, `cortex-tasks/`, etc.), or purging a stale generated artifact. Schema
changes to `PROFILE.md`/`REGISTRY.md` are handled by step 4, not here.

For each entry with a `Migrations` section:
1. Parse the migration steps.
2. Migrations only touch **data** files/folders (UPPERCASE in `cortex/`, or `cortex-tasks/`).
   They never edit managed files.
3. Execute each step or present it for confirmation if destructive (renames, deletions).

### 6. Report outcome

Structured summary:

| Area | Result |
|------|--------|
| Copier update | ✓ from vX → vY |
| Conflicts found | N (resolved: N) |
| Managed deletions | list or "none" |
| Managed renames | list or "none" |
| Schema reconciled | N fields (PROFILE/REGISTRY) |
| Migrations executed | N steps |
| Defaults accepted | list any newly-added answers, or "none" |
| Action required | list or "none" |

If everything is clean: "Upgrade complete — kernel at vY, no action required."

If issues remain: list each with clear next steps.

## Failure modes this path guards against

1. **Phantom conflicts** — copier merges leave `<<<<<<<` markers in steering files. The IDE loads them raw → broken rules/routing. This path catches and resolves them.
2. **Silent deletions** — copier removes a managed file the consumer edited locally. Without a diff report, the consumer doesn't notice until something breaks.
3. **Skipped schema updates** — seed-once files aren't touched by copier (by design). Diffing against `cortex/templates/seed/` catches schema drift regardless of which version the consumer started from, without replaying changelog history. Structural/data actions a diff can't express still come from the changelog's `Migrations` sections.
4. **Wasted or crashed runs** — a dirty tree or a non-interactive TTY prompt only surfaced as a failure *during* `copier update`, after other steps had already run. Step 0 checks both upfront, and `--defaults` removes the TTY dependency entirely.
