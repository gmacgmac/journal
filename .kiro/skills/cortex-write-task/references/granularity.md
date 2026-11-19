# Task Granularity

## Split vs. Merge Heuristic

A task should justify the cost of a fresh agent context. The orchestrator spawns one sub-agent per task — each re-reads TASK-STATUS.md, PLAN.md, the task file, and prior notes before doing any work. Over-granular plans pay that bootstrap tax repeatedly for trivial additions.

**Rule of thumb**: if two adjacent steps touch the same file with the same concern and have no decision point between them, merge them into one task.

**Batch small changes.** Small, low-risk changes in the same area (wording, a placeholder, a
divider, a tooltip) go in one task, even across several files. Each task pays for a fresh context
and its own verification.

**Prefer fewer, larger tasks.** Current models handle a whole surface in one task. Split only for
a reason in the table below. Every extra parallel task that writes files can also cost a git
worktree and a merge (§ Own Worktree).

**Don't let an open question block settled work.** If a design choice is unresolved, make it a
design-only task in the first wave that offers 2–3 genuinely different options, with the settled
rules written in so they aren't reopened. Only the task that needs the decision waits for it.

| Split tasks when... | Merge tasks when... |
|---|---|
| Different files / surfaces | Same file, same concern |
| Different risk profile (refactor vs integration vs test) | Sequential additions building one cohesive piece |
| Natural decision/review point between them | No human checkpoint needed mid-way |
| FE/BE boundary | Pure additive work on the same module |
| One task could block or invalidate the next | Tasks would always be done together anyway |

### Examples

**Over-granular (avoid)**:
- T01: Add interface to `module.ts`
- T02: Add function A to `module.ts`
- T03: Add function B to `module.ts`

Merge into one task: "Build `module.ts` (interface + function A + function B)".

**Appropriately split (keep)**:
- T01: Build `module.ts`
- T02: Swap call sites in `consumer.ts`
- T03: Tests for `module.ts`

Different surfaces, different risk profiles. Each deserves a fresh context.

### Quick Self-Check

Before finalising the task list, ask:
1. Could a reviewer accept or reject these tasks independently? If no -> merge.
2. Does one task's success change the approach to the next? If no -> consider merging.
3. Would I run all of these in one sitting myself? If yes -> consider merging.
4. For each Card: could a careful executor finish it without opening a file I didn't name, or
   making a choice I didn't make? If no -> add it, or make the task `strong`.

---

## Wave Assignment

Same wave = runs in parallel. Higher wave = runs later. You assign these in TASK-STATUS.md's
`Wave` column; the orchestrator obeys them without reading task files.

**Same wave only if all hold:**
- Disjoint file sets — no shared target. Record them in TASK-STATUS.md's File Ownership table.
- Neither consumes anything the other creates.
- Neither needs to see the other's output to decide its approach.

**Separate waves when:** one task creates something another imports, extends, or must match.

### Shared Foundations

The failure this prevents: three page tasks run in parallel, each needs a common validation
helper that does not exist yet, none owns it — so three near-identical helpers get written.
No file collision, so nothing detects it. File-overlap checks miss this entirely: the tasks
write *different* files containing the *same* logic.

Before assigning waves, list what the set creates and then reuses — shared types, helpers,
components, base classes, config, schema. For each:

1. Give it an owning task, in the lowest wave that needs it.
2. Put every consumer in a higher wave.
3. Record it in TASK-STATUS.md's Shared Foundations table with path + symbol.

If the shared thing is small and only one task truly needs it, fold it into that task instead
of adding a wave.

**Test**: for each parallel group, ask what these tasks would each have to invent to finish. If
they would invent the same thing, it belongs in an earlier wave.

---

## Own Worktree

File Ownership keeps parallel tasks out of each other's files. It doesn't stop one task's build or
tests from running against a sibling's half-finished edits. A task's own git worktree does: a
separate checkout on its own branch, which the orchestrator merges after the wave.

Set `Own worktree: yes` only if all of these hold:
- The task writes files.
- Another task in the same wave writes files.
- Either of them runs builds, tests, a type-check or anything else that reads the whole tree.

Otherwise `no`. Sequential sets and read-only tasks are always `no`; they pay nothing.

Before setting `yes`, check that the project can build and test in a fresh worktree: either
REGISTRY.md `git_worktrees.create_command` sets up dependencies, or the project needs none. A
default worktree has no installed dependencies. If it can't, don't use `yes`: merge the tasks, or
put them in separate waves.

A `no` task works in the checkout the set runs in. Git worktrees are never a default; this column
is the only thing that calls for one.

PLAN.md House Rules `Commits: none` → no git worktrees at all. A new worktree only sees committed
work, so the next wave would miss the last one.

**Test**: for each wave with two or more writing tasks, ask whether one task's checks could fail
because of another task's unfinished work. If yes, give each of them `yes`. If the tasks are
small, merging them into one task is often cheaper than two worktrees.
