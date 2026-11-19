---
name: cortex-task-exe
description: "Execute cortex task files: run a single task directly, or orchestrate a task set sequentially or in parallel waves via sub-agents (with the return contract and read discipline). Use for \"do the tasks\", \"run the task set\", \"execute TASK-STATUS\", or completing a single task file."
---

# Task Execution

Execute one or more cortex task files. Select a mode based on what was provided.

## Mode Selection

| Trigger | Mode |
|---|---|
| One task file (or "do next task") | **Single** — execute directly |
| TASK-STATUS.md with all-distinct or absent `Wave` values | **Sequential** — orchestrate via sub-agents |
| TASK-STATUS.md where two+ tasks share a `Wave` number | **Parallel** — orchestrate in waves |

---

## Task-Set Frontmatter Lifecycle

Whoever touches a TASK-STATUS.md first sets `status: in-progress` (from `planned`).

**Closing the set** — `status: completed` + `completed: YYYY-MM-DD` + the set LOG entry — happens
once, after the project's full gates pass:
- **An orchestrator is running the set** → the orchestrator closes it. A sub-agent never does,
  even when it finishes the last row.
- **No orchestrator** (tasks run one at a time, directly) → the agent that finishes the last row
  runs the full gates, then closes it.

A set can be run one task at a time by different agents, so don't assume someone already flipped
it. No-op if the value is already correct.

---

## Testing by Tier

Test in proportion to what the change can break. Judge the tier from the change itself:

| Tier | The change | Run |
|---|---|---|
| **Small** | Wording, styling, config values; one area, no logic | Tests of the files touched, plus lint / type-check. None exist → say so |
| **Normal** | Logic inside one area | Its own tests, plus tests of every shared pattern or file it changed |
| **Wide** | A contract, a Shared Foundations item, or more than one area | The project's full gates |

- Unsure → the higher tier.
- Every test run has a time limit (PLAN.md House Rules, else a few minutes). A run that hangs is a
  failure to report, not something to wait out.
- The full gates always run once, when the set closes.

---

## Commits

Sub-agents never run git commands that change state (commit, merge, branch, stash, checkout).
Whoever runs the work commits it, once it is checked:

| Who | Commits |
|---|---|
| Planner (`cortex-write-task`) | The task file or set folder, once written (`Plan: {task_name}`) |
| Orchestrator, sequential | Each task, once its return block checks out |
| Orchestrator, parallel | Each wave, once its gate passes |
| Orchestrator, set close | Once more, after the full gates and the set LOG entry |
| Single task, run directly (not a sub-agent) | Once your verification passes |

- **Check first**: `git status --short` shows only the files the work changed (the return blocks'
  `FILES`, when there are sub-agents), any orchestrator-owned files you changed, and the records:
  the set folder (PLAN.md, TASK-STATUS.md, task files) or the single task file, and
  `cortex/LOG.md`. Anything else stays unstaged; if it might belong to this work (a file the task
  changed but didn't list), stop and ask.
- **Stage by name**, never `git add -A`, then commit the same paths
  (`git commit -m "…" -- <paths>`): the checkout may hold someone else's work, staged or not,
  and this keeps it out.
- **Message**: `{TASK_ID}: {task title}` · `Wave {N}: {TASK_IDs}` · `Completed set: {task_name}`.
- PLAN.md House Rules `Commits: none` → the orchestrator and executors skip their commits, and the
  set can't use git worktrees: a task with `Own worktree: yes` as well → stop and ask. The
  planner's `Plan:` commit comes before the set runs and is not affected.
- The user can always say not to commit.
- Never push. The only merges are task worktrees back into the main checkout
  (`references/worktrees.md`). Branches, pull requests and merging the finished work are the
  user's call.

---

## Git Worktrees

Not a default. Only when the task set calls for it: a task whose `Own worktree` cell in
TASK-STATUS.md is `yes`. The planner sets that only for parallel tasks that write files and run
builds or tests (`cortex-write-task`). Then read `references/worktrees.md` at pre-flight; the orchestrator
creates, merges and removes those worktrees. Otherwise skip it: the set runs in the checkout and
branch it was started in.

---

## Mode: Single Task (Direct Execution)

You are the executor. Read the task file, do the work, report back.

1. Read the task file — note its steps, inputs, and constraints. Check your testing environment is ready before you start.
2. If the task references PLAN.md or TASK-STATUS.md, read those for context (prior task notes) and apply the **Task-Set Frontmatter Lifecycle** above. Ignore `Own worktree` when running a task directly; it applies to parallel waves only.
3. Adopt the persona, if the task has one — its `persona:` field, or its Persona cell in TASK-STATUS.md. It is your point of view: it helps you notice problems, never changes scope, ownership or stop rules. Report what you notice; record it under **Caught Beyond the Brief** in the task file's Implementation Notes.
4. Execute the steps. If issues arise, work through them — collaborate with the user if needed.
5. Do NOT deviate from the plan silently. If deviation is needed, stop and discuss. A Card (`model: standard`) holds every decision: one that needs a decision it doesn't contain is stopped and returned `BLOCKED`, naming the decision. Never guess.
6. Document findings in the task file's Implementation Notes.
7. Verify your changes by tier (§ Testing by Tier), plus whatever validation the task specifies.
8. Record any security concerns you surface in the task's Implementation Notes (or TASK-STATUS.md in a set).
9. Update your row in TASK-STATUS.md's table. Not a sub-agent and this was the last row → close the set per the Lifecycle above (full gates first).
10. Follow the task file's **On Completion** — append your own LOG entry for this task. One line, terminated with a newline, append-only; never `str_replace`. If you closed the set in step 9, also append the set entry.
11. Not a sub-agent → commit the task (§ Commits). A sub-agent → don't; the orchestrator commits.
12. Keep the user informed of progress and material findings along the way.

**Constraints**:
- Git per § Commits. As a sub-agent, no git commands that change state.
- Be concise — don't over-engineer.
- **Never write to `cortex/AUDITED.md`** in any mode. That is `cortex-garden`'s ledger — it records what has been *verified*. Task execution's record is the LOG entry.
- Long File Strategy is MANDATORY per workspace rules (survival-critical — see steering). Do not skip it even under time pressure.

**Return Contract** (when operating as a sub-agent):
```
---
TASK_ID: {TASK_ID}
STATUS: COMPLETED | BLOCKED | DEVIATION
FILES: <comma-separated paths created/modified, or "none">
VERIFICATION: <tier (small | normal | wide); what was checked and the result>
REQUESTS: <one per line: `path` — what's needed — blocking | non-blocking; or "none">
NOTES: <one line for the orchestrator; "none" if nothing>
---
```

`REQUESTS` is for changes needed in files this task doesn't own. Never make them — list them. Not
a sub-agent → tell the user instead. A Card that needs a decision it doesn't contain returns
`BLOCKED`, naming the decision in `NOTES`.

---

## Mode: Sequential Orchestration

You are the orchestrator. You NEVER do task work directly — you dispatch sub-agents. One
exception: a task that needs a person live (§ Sub-Agent Dispatch Protocol) you run yourself.

For the full sequential protocol (read-discipline checkpoint, dispatch loop, read discipline, return-block parsing), read `references/sequential.md`.

**Key non-negotiables**:
- Logging is two-level: each sub-agent logs its own task, the orchestrator logs the set. Each entry written exactly once.
- One sub-agent per task, in order. Wait for each to complete before dispatching the next.
- Pass TASK-STATUS.md and PLAN.md as contextFiles. Do NOT paste task file content into the prompt.
- Trust the sub-agent's return block; check its work yourself only where you judge it worthwhile.
- If any sub-agent reports BLOCKED or DEVIATION, stop and inform user.
- Route every `REQUESTS` item before the next dispatch.
- Commit each task once its return block checks out (§ Commits).

---

## Mode: Parallel Orchestration

You are the orchestrator. Dispatch independent tasks in waves. Same exception as sequential: a
task that needs a person live you run yourself.

For the full parallel protocol (wave assignment, dispatch, error handling), read `references/parallel.md`.

**Key non-negotiables**:
- Logging is two-level, same as sequential: each sub-agent logs its own task, the orchestrator logs the set. A whole wave appends at once, so one line ending in `\n`, append-only.
- Waves run in order; tasks within a wave run in parallel.
- Parallel tasks MUST NOT modify the same files — TASK-STATUS.md's File Ownership says who owns what.
- A wave gate runs between waves: task worktrees merged (if any), every request routed, orchestrator-owned files updated, tests green (full gates only after a wide wave), then the wave committed (§ Commits).
- Waves come from TASK-STATUS.md's `Wave` column, assigned by the planner. No Wave column → run sequential and say so.
- When in doubt about independence, run sequentially within that wave.

---

## Sub-Agent Dispatch Protocol

A task-execution sub-agent is a full agent instance. It has:

- **The same tool access as you** — file read/write, search, diagnostics, bash, web tools
- **Access to workspace rules and steering files** — it reads `.kiro/steering/` automatically
- **Its own autonomous execution** — it receives a prompt and optional `contextFiles`, then works independently and returns results
- **The orchestrator's model, by default** — if you don't name a model at dispatch, it silently runs on yours (often the most expensive tier)

It is not a dumb text processor. Do not duplicate file contents, rules, or context into its prompt. Tell it what to do and where to find it — it will read what it needs.

If the platform supports background/async sub-agent execution, dispatch that way so the orchestrator stays available to the user.

**Needs a person live** (a login, a one-time code, hardware, an outside account)? Don't dispatch it
in the background — a sub-agent usually can't reach the user. Run it yourself, in the foreground:
confirm the person is ready first, then one action or code per exchange.

**Model**: name one on every dispatch, never the default. Use the task's `Model` class (`standard` for defined-shape work, `strong` for pattern-setting, design, or debugging); the project's steering maps classes to models — if it doesn't, ask the user.

**Persona**: if the task's `Persona` cell in TASK-STATUS.md is set (individual mode: the task file's `persona:` field), paste it verbatim as the first lines of the prompt, then the framing line from the dispatch prompt (`references/sequential.md` · `references/parallel.md`). `—` → omit both.