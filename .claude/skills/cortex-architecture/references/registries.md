# Registries: References, Conditions and Jobs

Replace scattered local checks with declared tables. **References** say who depends on whom
and hold no state. **Conditions** say what is true now. Root cause comes from walking one with
the other. **Jobs** say what is running now.

The failure they prevent: the same fact re-derived in three places — a delete route, a banner
and a screen each decide "this is orphaned" — and the day a new kind is added, the copies
disagree.

Use the tables a project needs; each stands on its own. References only when data links to other
data. Conditions when more than one place must know a fact. Jobs once there are two kinds of
long-running work.

## References — who depends on whom

One table of edges, declared once: `{ from: kind, to: kind, how to read the link }`.

- **Every "X refers to Y" is one row.** Adding a kind of link is one row and nothing else.
- **No state, no writes.** Queries are pure reads computed per request — "unavailable" is never
  stored, so it cannot go stale.
- **Two questions:** what points at this row (`dependents`), and what points at a row that is
  gone (`orphans`).
- **One read per request.** Read the rows once into one snapshot and walk every edge over it, so
  every answer in a request agrees. Rows may live anywhere (a database, files, a remote service);
  the reader is passed in, never held in module state.
- **Rows can have owners** (a user, a workspace, a tenant). Each kind declares whether its rows
  belong to one owner or are shared by all. By default, a link runs from an owner's row to that
  owner's rows or to shared ones, never to another owner's. Where the project lets owners share
  (one user shares a document with another), the share is its own declared edge kind, so it is
  visible and tested.
- **A delete names what depends on it.** It refuses, listing the dependants (e.g. `409 in_use`),
  until the caller confirms. Only what belongs to that row alone goes with it (its own secret,
  its own settings).
- **Deletes orphan, never cascade.** A dependant stays put, unavailable and saying why. It
  refuses new actions; work already running finishes. Re-creating the referent heals it with no
  repair pass.
- Kinds are a closed list (e.g. TypeScript `as const`), so an unknown kind is a type error.

## Conditions — what is true now

One table keyed by condition kind, typed so a kind with no row is a compile error, not a hole
(e.g. TypeScript `Record<Kind, Row>`). Each row declares:

| Field | Meaning |
|---|---|
| `trueWhen` / `endsWhen` | One line each. A condition ends when its fact goes away — never by a write |
| `severity` | How loud |
| surfaces | Which places show it (toast, panel, status) — whether, not where |
| `scope` | Whose fact it is (one owner's, or the whole system's) |
| `entity` | Which row the condition is about — the key to root cause |

Conditions are computed fresh from real state, each with a readable reason.

**What a person did about it is stored apart.** The record a person sees and answers — seen,
dismissed, acted on — lives separately from the condition (a notice, an alert, a history row).
Dismissing hides the record; it never changes the fact, so the condition stays true until its
fact goes away. If ended records are kept as history, decide how long; an open one is never
removed.

## Root cause

For each condition, take its `entity`, walk the reference edges to what it depends on, and point
it at the condition about that dependency. No scoring, no hand-written cause pairs. A surface
draws a symptom **under** its root, never on its own.

- A fact about the whole system (no row) is always a root.
- Two conditions about the same row are both roots. A cause is only taken across an edge.
- **Cycles.** If no kind can link back to itself, directly or through others, the walk needs no
  cycle check; a test can hold the edge table to that. If one can (a folder inside a folder),
  track the rows visited and stop at a repeat.
- By default a cause never crosses owners: an owner's condition is caused by its own rows or
  shared ones. It crosses only along a declared sharing edge.

## Jobs — what is running now

Add it once two or more kinds of long-running work exist (downloads, imports, builds). Until
then, keep progress local.

One table keyed by job kind, typed the same way as conditions. Each row declares its label, `scope`
(one owner's, or the whole system's) and whether it can be cancelled. One tracker holds every
running job: started, progress, done, failed, cancelled.

- **Unlike the other two, it holds state.** Workers write to it; everything else only reads.
- **Decide where that state lives, and what a restart does.** Common answers: in memory (a
  restart ends every job; it is rerun, not resumed), a database table (jobs survive a restart and
  resume or fail), an outside queue (it keeps its own store). Record the choice in project
  steering.
- **Callers use its interface** (start, update, finish, list), never its storage — so where jobs
  live can change without touching a caller.
- **It reports; it doesn't schedule.** A queue still decides what runs next.
- **A job's ending is told where every other fact is.** A failure the person must act on stays
  live as a condition until it is fixed. One that needs no action (running it again is the fix)
  can simply be the job's ending — done, failed, cancelled — in the same history as condition
  records.

## When to use a local check

A local check is fine for state one screen owns. The moment a second reader appears, move it to
the tables.

## Tests

- Every kind has a row (the type system does this when keyed by kind).
- Every edge's read is exercised: a dependant appears in `dependents`; deleting its referent
  makes it an orphan; re-adding heals it.
- A delete with dependants refuses until confirmed; a confirmed one leaves them orphaned.
- With owners: links and causes cross owners only along a declared sharing edge.
- If kinds can't link back to themselves: the edge table has no cycles. If they can: a fixture
  with a cycle ends the walk.
- Root-cause attribution over a fixture with a known dependency chain.
- Dismissing a condition's record leaves the condition true.
- Jobs, if present: every kind has a row; a job moves through each state; a restart does what
  project steering says; a failure that needs action raises its condition.
