---
name: cortex-docs
description: "Write, file, and keep documentation true: place a doc in the REGISTRY.md doc surface without duplicates, and hold every claim about code to a symbol and a named test so drift fails the test suite, not a reader. Use when creating, updating, or retiring a doc, or when a code change may have made a doc claim untrue."
---

# Docs

Two jobs: put a doc in the right place, and keep what it says true. The second job is done by
the test suite at the moment of change — not by someone re-reading docs later.

**Docs come from task files.** Doc work is planned in a task (`cortex-write-task`), so the
reasoning is recorded with it. A trivial doc edit (`cortex-change-protocol` § Trivial changes)
needs no task, but still follows this skill.

## 1. Classify

1. Read `PROFILE.md` §2 — identify the primary category.
2. Destination: a folder in the `REGISTRY.md` doc surface (`docs.include`). Tasks are not filed
   here — use `cortex-write-task`.

**No category fits?**
- Learning Mode (`system_mode` in PROFILE §1): propose a new category via `[needs-human-input]`.
- Production Mode: log `[needs-human-input]` to `LOG.md`: "Structural Mismatch."

## 2. Locate (duplicate check)

1. Confirm the destination folder.
2. Search for existing docs in scope with `cortex-search` (Layers 1–3).
3. Decide: **Create**, **Update**, or **Archive**. Prefer updating an existing doc over adding one.

## 3. Process

### CREATE

1. Template from `cortex/templates/`:
   - `generic-document.md` — default. For a doc that describes how something works, use its
     **Mechanism** block (Property / Where / Proven by / Not covered).
   - `handler.md` — a routine/procedure the router dispatches to.
   - `tracker-template.md` — a queue of open items; a row is deleted once its task completes.
2. Match the format of existing docs in this category.
3. If docs use frontmatter: fill it (category, last_updated, status, scope, keywords).
4. Name the file kebab-case. Place it in a folder listed in `REGISTRY.md` `docs.include`.
5. No doc-surface folder covers this category → propose one via `[needs-human-input]`; do not
   write outside the fence.
6. Hold every claim about code per **§4 Keep it true**.

### UPDATE — audit first

1. List every claim the change made untrue — in this doc and any other doc that cites the
   same symbols (search for them).
2. For each claim, do one of: cite its symbol and the test that holds it; add the smallest test
   that would fail if it drifted; or delete the claim. Deleting a claim is a valid fix.
3. Apply the edit. No pre-edit snapshot — git is the history.
4. If the file uses frontmatter: update `last_updated`.

### ARCHIVE

1. Invoke `cortex-archive` (moves to `cortex/.archive/[YYYY]/`).
2. Moving it out of its `docs.include` folder removes it from the doc surface.
3. Remove or repoint any doc-to-test index row that named it (§4).

## 4. Keep it true

Full method: `references/doc-truth.md`. The non-negotiables:

- **A doc states only what something checks.** Every claim about code names its symbol
  (`path` + `symbolName`) and the test that holds it. **Never a line number** — they rot on the
  next edit.
- **Durable docs carry no current state** — no counts, progress figures or "what has landed".
  Derive those from the repo when needed.
- **Numbers come from code.** A number a doc states is checked by a test that reads the real
  constant; tests never hard-code a computed answer.
- **Decisions and tracker rows are cited by id**, never quoted.
- **Generated beats written.** Where a doc can be produced from code or a spec (an API
  reference), generate it and test it — see `cortex-architecture`.
- **No test suite?** Say so. Keep claims to the minimum, mark each mechanism's
  `Not covered: no test suite`, and log `[needs-human-input]` once so the gap is visible.

## 5. Validate

- Filename is kebab-case and the file is in the correct `docs.include` folder.
- Frontmatter, if used, is populated.
- Every claim about code has a symbol and a test, or sits under **Not covered**.
- The project's tests pass — including any doc tripwires.

Record the change per the change protocol. Inside a task, the task's own LOG entry covers it.
