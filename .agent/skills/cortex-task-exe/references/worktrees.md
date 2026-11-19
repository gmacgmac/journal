# Git Worktrees

Read this only when a task in the set has `Own worktree: yes` in TASK-STATUS.md. The planner
decided that (`cortex-write-task`); you carry it out. No such task → none of this applies: the set
runs in the checkout and branch it was started in.

A git worktree is a second checkout of the repo, in its own folder, on its own branch. It lets
parallel tasks that write files build and test without seeing each other's unfinished work. You
create, merge and remove every task worktree. Sub-agents never run git commands that change state.

## Terms

| Term | Meaning |
|---|---|
| **Main checkout** | The folder the set runs in, on whatever branch it is on. The set's records (PLAN.md, TASK-STATUS.md, task files) and `cortex/LOG.md` are edited here only. |
| **Task worktree** | A git worktree for one task, branched from the main checkout's current commit and merged back after its wave. It holds code changes only. |

## Rules for you, the orchestrator

- **Never `cd` into a worktree.** Use `git -C <path>` and absolute paths. A `cd` can leave your own
  session inside a folder you later delete.
- **No bare `git stash`.** One stash is shared by every worktree. Set work aside with a commit on
  its branch instead.
- **Commands come from PLAN.md House Rules** (the planner copies them from REGISTRY.md
  `git_worktrees`). None given → the defaults below.

| What | Default |
|---|---|
| Folder | `../{repo folder}-worktrees/{name}`: beside the main checkout, never inside it, where search, tests and linters would pick it up |
| Name and branch | `{set folder name}-{TASK_ID}` |
| Create | `git -C <main checkout> worktree add <folder> -b <branch> HEAD`: branches from the main checkout's current commit |
| Remove | `git -C <main checkout> worktree remove <folder>`, then `git -C <main checkout> branch -d <branch>` |

A project's own commands take the same inputs: `create_command <name> <start commit>` (the main
checkout's `HEAD`) and `remove_command <name>`.

A new worktree holds committed files only: no installed dependencies, no untracked config (such as
`.env`), no uncommitted work. A project that needs those declares a create command that sets them
up. A task that fails because they are missing reports it; nobody patches around it.

`worktree remove` refuses a worktree with untracked files, and `branch -d` refuses an unmerged
branch. Either refuses → stop and report. Never force.

## Pre-flight

1. Run `git worktree list`. Report any worktree in the worktrees folder that this set doesn't use
   (left over from earlier sessions). Never remove one without asking.
2. **Task worktrees this set left behind** (an earlier run stopped mid-wave) → tell the user what
   you found, then deal with each before identifying pending tasks:
   - **Already merged** (`git -C <main checkout> merge-base --is-ancestor <branch> HEAD`) → just
     remove it.
   - **Row says `Completed`** → run § After a wave returns steps 1–3 for it, so its finished work
     is merged rather than lost. No return block survives a stopped run: check against the task's
     File Ownership files instead, and route any requests in its TASK-STATUS notes.
   - **Any other status** → ask: keep it for inspection, or remove it and re-run the task. A kept
     worktree blocks that task until it is removed.
3. Every path you hand a sub-agent is absolute.

## Before each wave

Only for a wave that has a task with `Own worktree: yes`:

1. The main checkout has no uncommitted code changes and nothing staged (records may be changed
   but unstaged). A new worktree only sees committed work, and git refuses to merge into a
   checkout with staged changes. Uncommitted changes that are this set's work → commit them first
   (SKILL.md § Commits). Anything else (e.g. the user's own work) → stop and ask.
2. For each task with `Own worktree: yes`, run the create command. Note the absolute path, the
   branch, and any resources the command prints (e.g. a free test port).

## Where You Work block

Put this in the dispatch prompt of each task with `Own worktree: yes`, right after the persona
lines (or first, if there is no persona). Other tasks get no block.

```
WHERE YOU WORK
Your checkout: {absolute task worktree path} (git worktree, branch {branch})
- Your shell starts in a different folder, and a `cd` doesn't carry over between commands. Run every shell command in {absolute task worktree path}: set your shell tool's working-directory option to it if it has one, otherwise begin the command with `cd {absolute task worktree path} &&`.
- Read and edit code by absolute path under {absolute task worktree path}.
- Your task file, your TASK-STATUS.md row and cortex/LOG.md live in the main checkout. Edit them only under {absolute main checkout path}, never the copies in your checkout.
- Never touch any other checkout.
- No git commands that change state (commit, merge, branch, stash, checkout). The orchestrator handles git.
- Resources: {per-task resources, e.g. test port 3100}
```

Drop the `Resources` line when there are none.

## After a wave returns

Any sub-agent BLOCKED, DEVIATION or failed → the pipeline stops (parallel.md § Error Handling).
Leave every worktree as it is and report the paths. The next run's Pre-flight picks them up.

All COMPLETED → for each task worktree, in TASK-STATUS.md order:

1. **Check**: `git -C <task worktree> status --short` lists only the return block's `FILES`.
   Anything else → stop and ask. A change to the set folder or `cortex/LOG.md` → the task edited
   records in the wrong checkout; stop and report.
2. **Commit** in the task worktree (SKILL.md § Commits), message `{TASK_ID}: {task title}`.
3. **Merge** into the main checkout: `git -C <main checkout> merge --no-ff --no-edit <task branch>`. A
   conflict → `git -C <main checkout> merge --abort`, stop and report: two tasks touched the same
   file, a File Ownership error. Never resolve it by hand without asking.

Then the rest of the wave gate runs on the merged result (parallel.md § Wave Gate): requests
routed, orchestrator-owned files regenerated once, tests, the wave commit. After the wave commit,
remove each merged task worktree and its branch.

Never push.
