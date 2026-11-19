# Sequential Orchestration Protocol

You are the orchestrator. Your ONLY job is to coordinate — you NEVER do task work directly.
One exception: a task that needs a person live you run yourself, in the foreground (SKILL.md
§ Sub-Agent Dispatch Protocol).

## Input Modes

- **Batch mode**: A TASK-STATUS.md containing a table of tasks.
- **Individual mode**: One or more standalone task files provided directly by the user.

In BOTH cases, spawn a task-execution sub-agent for EACH task (except the live-person exception above). One sub-agent per task, sequentially.

---

## Pre-Flight

### Batch Mode
1. Read TASK-STATUS.md — extract the task table.
2. Read PLAN.md — understand the full context.
3. Identify pending tasks — filter for `Pending` or `In Progress` status, preserve order.
4. Note the **File Ownership** table if present — which task owns which files, and the
   `orchestrator` row of files only you may touch. Note PLAN.md's **House Rules** if present.
5. Frontmatter Lifecycle (SKILL.md): flip `status` to `in-progress` if needed.

Sequential tasks never run in git worktrees: `Own worktree` applies to parallel waves only.

### Individual Mode
1. Read each task file provided by the user.
2. Tasks execute in the order provided.
3. If a task file references a parent context doc, read that too.

### Then (both modes)
Confirm with user: "I found N pending tasks: [list]. Proceeding sequentially via sub-agents."

---

## Read Discipline Checkpoint

Pre-flight reads end here. From now on, before reading any file, ask: "is this read justified, or am I duplicating sub-agent work?"

---

## Execution Loop

For each pending task (in order):

### 1. Prepare
- Identify the next pending task ID.
- DO NOT read the task file yourself — the sub-agent will.
- DO NOT re-read PLAN.md inside the loop. Re-read TASK-STATUS.md only to route requests (§ 3).

### 2. Dispatch

Invoke a task-execution sub-agent with:

**contextFiles** (pass as file references):
- Batch mode: TASK-STATUS.md and PLAN.md
- Individual mode: the task file itself (and parent docs if any)

**Prompt** (lean; persona lines only when the task has one — batch: its `Persona` cell, individual: its `persona:` field; none or `—` → omit both):
```
{Persona, verbatim}
This is your point of view. Use it to notice problems the task doesn't mention. It never changes your scope, file ownership or stop rules — report what you notice (REQUESTS / NOTES / BLOCKED), don't act outside your task.

Complete the next pending task ({TASK_ID}) from the provided TASK-STATUS.md.

Rules:
- You are a Sub-Agent
- Read the task file and PLAN.md for full context; load the skills its Skills field names before starting
- Read notes from completed tasks before starting
- Only modify the files your task owns (TASK-STATUS.md File Ownership if present, otherwise your task's Files to modify / Files Involved). Need a change in a file you don't own? Don't make it — list it under REQUESTS
- No git commands that change state (commit, merge, branch, stash, checkout) — the orchestrator commits
- Don't close the set (`status: completed`, the set LOG entry) — the orchestrator does that
- Don't over-engineer — be concise
- Reuse existing patterns: search the repo first, import or follow what exists, never copy it
- If you need to deviate from the plan, report back to the orchestrator
- Update the task file's Implementation Notes when done
- Update TASK-STATUS.md when done
- Follow the task file's On Completion, including your own single LOG entry (one line, ends with a newline)
- Test by tier (SKILL.md § Testing by Tier), with a time limit on every run, and name the tier in VERIFICATION. The orchestrator runs the full gates.
- No new external dependencies unless the task file calls for them
- Survival-critical (workspace rules, non-negotiable): any write >50 lines: CREATE first section, then APPEND in chunks. If you hit repeated connection-reset errors, STOP — do not retry in a loop — report it as a violation and switch to chunked appends.

Return Contract — your final message MUST end with this block, exactly:
---
TASK_ID: {TASK_ID}
STATUS: COMPLETED | BLOCKED | DEVIATION
FILES: <comma-separated paths created/modified, or "none">
VERIFICATION: <tier (small | normal | wide); what was checked and the result>
REQUESTS: <one per line: `path` — what's needed — blocking | non-blocking; or "none">
NOTES: <one line for the orchestrator; "none" if nothing>
---
```

When a request was routed to this task, add it to the prompt: `Also handle {REQUEST_ID}: {need}.`
Re-running a blocked task? Tell the sub-agent it is Run N; it adds a Run N block to its notes rather than overwriting.

### 3. Wait & Verify
- Trust the sub-agent's return block. Parse STATUS, FILES, VERIFICATION, REQUESTS, NOTES.
- **Route every request before the next dispatch.** Batch mode: re-read TASK-STATUS.md, add each
  to its Requests table (`{TASK_ID}-R{n}`; no table in an older set → add one from the template)
  and route it — a later task that owns the file (per File Ownership) · you, if the file is
  orchestrator-owned · a tracker row, if it is outside this set · `closed` with a reason.
  Individual mode: report each to the user. No owner fits → stop and ask the user.
- **Requests routed to you**: make the change before the next dispatch.
- **Mark a request `Done`** once a return block (or your own change) shows it handled.
- If `STATUS: BLOCKED` or `DEVIATION` — STOP, inform user with the sub-agent's NOTES.
- If the return block is missing or malformed — treat as failure, ask the sub-agent to re-report.
- If `STATUS: COMPLETED` — commit the task (SKILL.md § Commits), give a brief status update,
  proceed to the next task.

### 4. Status Update
After each task: `[check] [TASK_ID] complete. [N] remaining.`

---

## Orchestrator Read Discipline

Reads of TASK-STATUS.md and PLAN.md are budgeted:
- **Once at pre-flight** — to identify pending tasks.
- **Once at the end** — to confirm final state before logging.
- **Inside the loop** — TASK-STATUS.md only, and only to route requests. Never PLAN.md. Otherwise
  trust sub-agent return blocks.

Each sub-agent owns its task file.

Between dispatch cycles, the orchestrator's inputs are the structured return blocks from prior sub-agents. Its only TASK-STATUS.md edit inside the loop is the Requests table.

---

## On All Tasks Complete

Logging is **two-level, each entry written exactly once**: every sub-agent appends its own task
entry via its task file's On Completion; the orchestrator adds one set entry. Never write a
sub-agent's entry for it, and never write to `AUDITED.md` — that is `cortex-garden`'s ledger alone.

Before anything below: run the project's full gates (build, tests, lint). On a failure, don't mark the set complete; report it.

### Batch Mode
1. Frontmatter Lifecycle (SKILL.md): flip `status: completed`, `completed: YYYY-MM-DD`.
2. Append the **set** entry to `LOG.md` — one line, terminated with `\n`. `[CATEGORY]` from `PROFILE.md` §2:
   `[[YYYY-MM-DD HH:MM]] [CATEGORY] Completed set: {task_name} → Task: [[path/to/TASK-STATUS.md]]`
3. Commit the close (SKILL.md § Commits).
4. Report to user: `All [N] tasks complete. TASK-STATUS.md updated. LOG entry created.`

### Individual Mode
1. Each task file's On Completion is handled by its sub-agent — including its LOG entry.
2. **No set entry.** There is no set, so the orchestrator adds nothing; the per-task entries are the complete record.
3. Report to user: `All [N] tasks complete. Task files updated. LOG entries created.`

---

## Error Handling

- **Sub-agent reports blocker**: Stop pipeline, inform user with full context.
- **Sub-agent reports deviation**: Stop pipeline, inform user, wait for approval.
- **Sub-agent fails/times out**: Report to user, do not skip.
- **Sub-agent loops on connection resets**: This is a Long File Strategy violation — the sub-agent wrote a large file in one shot instead of chunking. Stop that sub-agent, report, re-dispatch ONCE with an explicit chunking reminder. If it recurs on the retry, STOP — do not keep re-dispatching — escalate to the user instead of looping the orchestrator itself.
- **Verification task fails**: Report failures — do not mark as complete.
