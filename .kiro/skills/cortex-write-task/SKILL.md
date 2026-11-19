---
name: cortex-write-task
description: "Author cortex task file(s): a single self-contained task, or a multi-task set (PLAN + TASK-STATUS + individual task files). Use when asked to plan work, write it up as tasks, or break an effort into executable steps."
---

# Write Task

Author one or more task files to capture planned work. The scope determines which branch to follow.

## Branch Selection

- **No task** — the change is trivial (`cortex-change-protocol` § Trivial changes). Don't write one; log and commit it as that section says.
- **Single task** — one self-contained file covers the work. Use when the effort is small, touches few files, and needs no orchestration.
  - **Small set** — three `standard` tasks or fewer in one area go in ONE file (one numbered step group per task), not a folder.
- **Multi-task set** — a folder with PLAN.md, TASK-STATUS.md, and individual task files. Use when work spans multiple surfaces, risk profiles, or agents.

Pick the branch, then size each task (§ Size), then follow the steps below.

## Size

Size follows `model`. **Cut context, keep instructions:** background and restated rules shrink;
what to change, where, and how to prove it gets sharper.

- **`standard` → a Card** (`cortex/templates/tasks/task-card-template.md`): every decision already
  made, exact files and symbols, exact edits, the proof. About 25 lines of instructions by
  default; project steering may set its own.
- **`strong` → the full template.** It can still be short.
- **A `standard` task leaves no design decision open.** Meet one while writing it? Make the
  decision in the Card, or raise the task to `strong`. The thinking is done once, by the planner.
- **Risk forces `strong`:** security-covered files, a contract or schema change, data on disk,
  multi-day work.
- **No restated rules or background.** Point to the project's standing rules and PLAN.md; never
  copy them in.
- **Notes are never capped.** They are the record each checking layer works from: the executor
  writes them, the orchestrator checks the work against them, and the final review checks again.

---

## Branch A: Single Task

1. **Determine category and concern** — pick the category from `PROFILE.md` §2; **derive the concern** from the category-name prefix (see PROFILE Conventions), unless `REGISTRY.md` declares a `concern` override. No category matches → flag for the user to register first.
2. **Create task file** — path: `cortex-tasks/{concern}/{YYYY-MM-DD}_{category}[_{subdomain}]_{task-title}.md`. Use `cortex/templates/tasks/task-card-template.md` (with its frontmatter) for a `standard` task, `cortex/templates/tasks/single-task-template.md` for a `strong` one (§ Size).
3. **Fill content** — `model` (`standard` | `strong`), problem statement, numbered steps, files involved, constraints, success criteria, references, implementation notes section. Fill `persona:` when a point of view helps (see § Personas).
4. **Name the skills the task needs** — fill the `skills:` frontmatter field (see § Skill Routing below).
5. **Research variant** — if `type: research`, see `references/research-variant.md` for the research-task format additions (banner, research objectives, result file).
6. **Commit the task file** — per § On Finishing Authoring.

## Branch B: Multi-Task Set

1. **Determine category and concern** — same as Branch A.
2. **Create folder** — `cortex-tasks/{concern}/{YYYY-MM-DD}_{category}[_{subdomain}]_{title}/`, in the current checkout.
3. **Write PLAN.md** — use `cortex/templates/tasks/plan-template.md`: one page, not counting Decisions; rules by reference, never copied in. Problem, solution, key changes, dependencies, House Rules if the project has any (orchestrator-only files, commit policy, project checks, test time limit, and — only when a task has `Own worktree: yes` — the git worktree commands and per-task resources from REGISTRY.md `git_worktrees`), and Decisions: every ruling the user made in conversation, so executing agents never re-derive intent from chat. Branches, protected branches and pull requests are the user's or the project's call: record what they asked for in Decisions, never invent a policy.
4. **Write TASK-STATUS.md** — use `cortex/templates/tasks/task-status-template.md`. Frontmatter, task table, implementation notes sections.
5. **Write individual task files** — `cortex/templates/tasks/task-card-template.md` (frontmatter deleted) for `standard` tasks, `cortex/templates/tasks/task-template.md` for `strong` (§ Size). Name format: `[TYPE]_{##}_{task-title}.md`, where `[TYPE]` marks the work type and drives agent assignment: `BE` (Backend), `FE` (Frontend), `VERIFY` (Verification), `MANUAL` (Human action), a domain tag (e.g. `API`), or a generic `T` when the work is a single stream with no separate-agent split. Split along surface boundaries (e.g. FE/BE) — separate agents may complete those tasks. Include a final `VERIFY_01` task when the set has a wide change (`cortex-task-exe` § Testing by Tier); it tests the implementation (targeted, not a generic `npm test`), and if the set touches code a doc describes, it also runs the `cortex-docs` doc audit. VERIFY also asks: did any `standard` task make a design choice? If yes, report it. A set of small changes needs none — the closing gates verify it. Each file: objective, inputs, steps, validation, notes section, and its `Skills` (see § Skill Routing).
   - **Needs a person live** (a login, a one-time code, hardware, an outside account) → make it a `MANUAL` task, or say so in the task's Objective, with what the person must have ready. The orchestrator then runs it in the foreground, one action or code per exchange.
6. **Fill the TASK-STATUS columns and tables** — the planner's call, not the executor's: the orchestrator schedules from PLAN.md and TASK-STATUS.md alone, never task files, so anything left blank it must guess.
   - **Wave** and **Model** (`standard` | `strong`, never a model name) columns.
   - **Own worktree** column (`yes` | `no`) per `references/granularity.md` § Own Worktree. Sequential sets and read-only tasks are always `no`.
   - **Persona** column (`—` for none) per § Personas. TASK-STATUS.md only: not in PLAN.md or task files.
   - **Shared Foundations** table.
   - **File Ownership** table — required when two or more tasks share a wave (each file has one owner per wave), or when some files are orchestrator-only, in any mode. The `orchestrator` row lists files no sub-agent may touch (e.g. lockfiles, generated code, version files), mirroring PLAN.md's House Rules. The icon set is a shared file: one owner per wave.
7. **Apply granularity heuristics** — before finalising, run the split-vs-merge, wave and own-worktree self-checks (see `references/granularity.md`).
8. **Commit the set** — per § On Finishing Authoring.

---

## Skill Routing

Executing sub-agents follow their task file; they don't go looking for skills. So the planner
loads the relevant skill **while planning**, applies it to the plan, and names it in each task's
`Skills` field.

| Task involves | Skill |
|---|---|
| Front-end, back-end, API, MCP, schema, data layer, shared components | `cortex-architecture` — load it before writing PLAN.md, and follow project steering where it already decides |
| Creating, updating or retiring docs; changing code a doc describes | `cortex-docs` — destination comes from the `REGISTRY.md` doc surface, never a hardcoded path |
| Investigation only, no code changes | `cortex-research` |

Also name any project skill the task needs (e.g. a UI design skill). Leave `Skills` empty for work
none of these cover.

---

## Personas

A persona gives the executing agent a point of view, so it notices problems the plan never
mentioned (methodology, technical requirements, security). It is not a rule set.

- **Format**: `<real job title> — <1–2 sentences: what they care about / won't compromise on>`.
  E.g. "Principal platform engineer — a child process is a liability until it is bounded,
  restartable and refuses everything it wasn't asked to do."
- **Best in field** — the persona is the best person in that role (`cortex-rules` rule 15).
  The title stays real; the 1–2 sentences say what the best would never let through.
- **When**: optional. Required for review tasks (e.g. `VERIFY`) and `strong` tasks. Skip it for
  mechanical work (rename a field, bump a version).
- **Real job titles** — never invented characters or names.
- **Match the main risk** — layout engineer for reflow, auditor for data contracts,
  trust-and-safety reviewer for anything an AI proposes.
- **Review tasks get a user persona** with no builder context — fresh eyes: a user of the best
  products in the category.
- **Model ≠ persona** — model is how much capability; persona is what to watch for.
- **Never overrides** scope, file ownership, working rules or stop conditions. A problem outside
  the task is reported (`REQUESTS` · `NOTES` · `BLOCKED` if unsafe to finish), never fixed.

---

**Task from tracker items** → set `tracker:` in the frontmatter (TASK-STATUS.md or the single task file).

---

## Naming Rules

- Separator is `_` (underscore), even though categories contain `-` (hyphen).
- Task title is REQUIRED — never omit it.
- Research tasks include `research` in the filename.

## Your Role (planner)

You are the planner/architect: provide instructions, file references, and function names for reusability, and keep executing agents focused on the bigger picture. **Do NOT create READMEs or Reference Guides** — all information goes in PLAN.md, TASK-STATUS.md, and the task files. Result files only where the result is the product (a research finding, a measurement, a proof, a test report); never for a build task, whose record is its notes.

Reuse only works if you wire it up. An agent can find a pattern that already exists in the repo — point it there. It cannot see a pattern a sibling task is building right now; sub-agents run blind to each other. Anything this set creates and then reuses must be named in Shared Foundations and ordered by wave, or every consumer builds its own copy.

## Constraints (in every task file)

In full in a `strong` task; as the one **Rules** line of a Card.

- If deviation needed, collaborate with user — do not make breaking changes silently.
- No PII in examples.
- No git commands that change state by executing sub-agents. The orchestrator commits each checked task or wave (`cortex-task-exe` § Commits).
- Update task file with implementation notes on completion.

## On Finishing Authoring (this skill's own completion)

- This skill writes task file(s) — it does not execute them. Authoring the file(s) is not
  a loggable event.
- Do NOT log to `LOG.md`. Logging `status: completed` / implementation notes / a `LOG.md`
  entry happens when the task is later *executed* (see `cortex-task-exe`), not when it is
  written.
- **Commit what you wrote**, on the current branch: stage only the task file or the set folder,
  by name, never `git add -A`, then commit those paths alone
  (`git commit -m "Plan: {task_name}" -- <paths>`), so other work in the checkout, staged or
  not, stays out. A set may sit for a while before it runs; committing it keeps it safe, and git
  worktrees made later only see committed work. The user can say not to commit yet.
