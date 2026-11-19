# Actions: One Layer for People and Agents

Everything a person or an agent can do through the app is an **action**: one definition, run
through one function, checked and recorded the same way whoever calls it. A button, a keyboard
shortcut, a command palette, an in-app assistant and an outside agent (MCP, WebMCP, a CLI) all
call the same `runAction(id, input, caller)`.

The failure it prevents: a button that calls an API directly, a separate "agent API" that makes
the same change again, and an assistant feature that does a third version. Each checks
permissions its own way, only one asks for confirmation, and the record of who did what is split
three ways.

**When to use it.** Any front end that changes data, and any project where more than one kind of
caller can change things. Start it with the first action that changes something. Projects start
small and grow; moving scattered handlers in later costs far more than starting here.

**When not.** A read-only tool, or a one-screen app with no agents and no audit need.

Start with **the core**. Each **extension** says when to add it. Builds on `registries.md`
(blocking rules are rows of the conditions table; long-running actions report into the jobs
table) and `words.md` (every title, description and reason).

## Is it an action?

Not everything is. Decide per thing, at planning:

| Case | Answer | Examples |
|---|---|---|
| Changes data or the platform; costs money; public or destructive | Always an action | save, delete, publish, create a playlist |
| A caller must be able to ask for it by name, or an agent must drive it on screen so the person sees it | An action that changes no data | select items, apply a filter, export, copy |
| Visual state only the person drives | Not an action; stays in the component | hover, scroll, open a panel |
| Continuous input | Not one per event; the action fires on commit | drag → drop, typing → save |

**Unsure → ask the user.** Think ahead: will an agent ever need to do this, or a person ask for it
by name? If it might, ask whether to make it an action now. Record the answer in project
steering, so later plans decide the same way.

## Principles

1. **One path for every caller.** Exactly one function runs an action, and every check lives
   inside it, so no caller can skip one. A caller that needs something different gets an option
   on that function, never its own path.
2. **An action is data plus one behaviour.** Everything but the behaviour is plain, serializable
   metadata: id, title, description, input schema, permission, flags. That is the shape of an
   agent tool, so exposing an action to an agent is a mapping, not a rewrite.
3. **Declare, don't hide.** Whether it changes data, costs money or needs a person's click are
   declared fields, not logic buried in the behaviour.
4. **Checked when it loads.** A bad definition fails when it is registered, naming every problem,
   so it never reaches a caller. Rules that must hold together (a costly action needs a click)
   are enforced there, not by review.
5. **Agents propose, people decide.** Anything destructive, public or costly needs a person's
   click. An agent never holds more permissions than the person it acts for.
6. **Refusals are results, not errors.** A refusal comes back as a value (`ok: false`, an
   outcome, a reason). A thrown error often loses its reason on the way to an agent.
7. **Availability is computed, never stored.** Whether an action can run now comes from current
   state on every call, so it cannot go stale.
8. **Show why, not just that.** An action that does not apply stays visible and disabled, with
   its reason. People and agents see the same list with the same reasons.
9. **Every call is recorded,** refusals included.
10. **The layer knows nothing of how it is exposed.** No UI framework, no MCP, no WebMCP inside
    it. Adapters at the edge do that, so a changing standard changes only its adapter.

## The core

### A definition

Field names are illustrative; the project names them.

| Field | Meaning |
|---|---|
| `id` | Dotted and stable (`playlist.create`). A permanent key in audit records; short, since agent tool names have length limits |
| `title`, `description` | What it does and when to use it, written for people and agents. From a words file |
| `input` | Schema of the input (below). Items it acts on are pointers (`kind`, `id`), never whole records, so a caller cannot pass a stale or forged copy |
| `accepts` | Item kinds it acts on, one or many; or none, for an action on the context itself |
| `conditions` | Condition ids that block it for an item while true: rows of the conditions table, never inline checks |
| `permission` | The one named permission a caller must hold |
| `effect` | Changes data or not. One that changes nothing never needs a click |
| `needsHumanClick` | A person must do it. True for destructive, public or costly |
| `cost` | None, or costly (bills the account). Costly implies a click |
| `returnsUserContent` | The result holds text users entered; an agent's host treats it as data, not instructions |
| `run(input, deps)` | The behaviour, reached only after every check passes |

`deps` hands `run` what it needs instead of globals (the caller, the context, a cancel signal,
the audit sink, a clock), so every action is testable with fakes. `run` calls the request layer,
never the network directly.

### Running one

`runAction(id, input, caller)` checks in this order: cheap, caller-independent checks first, and
nothing touches the platform until all pass.

1. Unknown id → refused.
2. Input fails the schema → refused, listing the problems. Callers outside your code send
   anything, so every run checks.
3. Copy the input, so the caller cannot change it mid-run.
4. Caller lacks the permission → refused.
5. Needs a click and the caller is not a person → refused. Treat anything but a well-formed
   person as an agent, so a malformed caller cannot skip the check. This comes before
   availability, so an agent learns "a person must do this" rather than chasing conditions it
   can never satisfy.
6. Not available for the given items → refused, with every reason.
7. Cancelled → refused.
8. Run. A throw becomes `failed` with a fixed sentence; the error's own text is dropped.
9. Write one audit record, whatever happened.

Expose steps 1–7 as their own function, so a button's pre-flight or a batch starter applies
exactly the same rules.

### Availability

`availabilityOf(action, context, items)` returns one of three states, each with its reasons:

| State | When | A surface shows |
|---|---|---|
| `enabled` | Applies to every given item and nothing blocks it | Normal |
| `dimmed` | Applies only partly (mixed kinds, many given to a one-at-a-time action), or a condition blocks some items | Disabled, the reason, and a way forward ("Continue with the 7 that fit") |
| `no-fit` | Applies to none of the given items | Disabled with its reason, still shown (principle 8) |

- Reasons are typed ids with fixed text and a count: a condition id, or one of the layer's own
  (wrong kind, one at a time). One problem appears once, at its root (`registries.md` § Root
  cause).
- Never run on part of the input unless the person chooses that. A partial fit returns the items
  it applies to; the caller asks before narrowing.
- The same answer for every caller: a disabled button, an agent's action list and a refusal carry
  the same reasons. That is what lets an agent explain itself.

### Input schemas

Write inputs in a small, closed subset of JSON Schema (type, description, enum, required,
properties, items, min/max counts and lengths). Any other keyword is refused when the action is
defined.

- What an agent reads is exactly what is enforced. A full validator invites keywords one side
  honours and the other ignores.
- Every object is closed: an unknown key is refused, not ignored.
- Every property has a description written for agents. Tool hosts cap name and description
  lengths; keep the caps in one constant.

### Permissions

- Each action names one permission; the caller's set must hold it.
- An agent gets the person's set or fewer, never its own wider one.
- Where permissions come from is a project decision (below), resolved server-side for anything
  that writes.

### Audit

One act, one record: the action id, the caller (a person, or an agent and how it connected), who
proposed it if anyone, the checked input (pointers and enum values; empty when it failed the
schema, so a forged input is never stored as valid), the outcome, the reason, and a timestamp.

- Callers write through an audit interface, never to storage. Start with an in-memory one for
  tests; decide where records are kept before real users.
- An action whose `run` records several steps has them folded into the one record.

### Fixed words

Every title, description, reason and refusal is a fixed sentence from a words file, with counts
filled in. Never an error message, API data or customer text.

## Where the trust boundary sits

The common mistake: building the whole pipeline in the browser and calling it security.

- **A client-side `runAction` guards honest callers; it is not a boundary.** The caller and its
  permissions are whatever is passed in, so any script in the page can claim to be a person with
  every permission. It still earns its place: consistent surfaces, early feedback, good reasons
  for agents.
- **The server verifies what matters:** identity from a real session, permissions resolved
  server-side, the person's click proven to the server (for example a short-lived token minted
  only by a person's gesture), and the audit record written server-side.
- **A shared account key hides everything.** While one key signs every write, per-person
  permissions and audit are fiction. Say so in the docs until it is fixed, rather than describing
  the target as built.
- **Order of work:** identity → server-side permissions → server-side audit → only then let a
  costly or public action reach real users, or expose actions to outside agents.

## Extensions — add each when its trigger appears

| Extension | Add it when |
|---|---|
| Guided flows | An assistant does several steps the person should watch |
| Proposals | An agent should be able to suggest something that needs a click |
| Batches | One change applies to many items |
| Long-running actions | Work runs on the platform for minutes after you ask |
| Billed requests | A request charges the account |
| Pre-checks | A person applies a change to many items and must see what it overwrites |
| Placeholders | A planned action should show up before it is built |
| Ports | An action depends on something the app connects at startup |
| Agent adapters | An in-app assistant or outside agent (MCP, WebMCP, CLI) will call actions |

### Guided flows

An assistant chains real actions so the person sees each step. For example: find items (changes
no data; runs and shows results), select them (drives the screen; runs, the items highlight),
create a playlist from them (changes data; waits as a proposal the person can edit, then
clicks). Each step goes through `runAction` with its own checks and record. Nothing that changes
data runs until the person clicks, and the assistant never makes free-form API calls.

### Proposals

- **One-shot.** An agent calling a click-required action is refused. To act on its suggestion, a
  person runs it with the agent named as proposer; the record reads "proposed by the assistant,
  approved by you". The proposer is kept only when the caller is a person and the proposer an
  agent: an agent never vouches for itself.
- **Batch or job.** An agent's start becomes a proposal, checked and recorded as proposed. It
  runs only when a person confirms. The person may drop items or change values first; a line that
  removes or weakens something is shown unticked with a warning. Discarding is recorded too.

### Batches

- One item at a time: queued → running → done | failed | skipped. A failure never stops the rest
  and is not rolled back. Cancel stops before the next item; retry runs only the failed ones.
- Progress is saved after each item, so a reload can resume (resuming is a person's click).
- One audit record per pass, with a line per item holding the previous values of what it
  changed. That is what makes a change reviewable and undoable by hand.

### Long-running actions

Same definition, same checks before it starts. The action starts a job and reports into the jobs
table (`registries.md` § Jobs); every surface reads the one tracker, no screen keeps its own copy.

### Billed requests — sent once

- If the platform takes an idempotency key, send one; a retry is then safe.
- If not: record the job as `sending` before the request goes out. A 4xx means nothing started:
  fail it. A 5xx or no answer means you don't know: mark it `unknown` and never resend. A reload
  that finds `sending` reads it as `unknown`.
- A retry loop on a billing call is how an account gets charged twice.

### Pre-checks

A pure function of the data the caller already holds: what applying would overwrite (current →
next), what it would leave alone and why, and what stops it. No request, no clock, so the review
renders at once. It is advice: the action still checks every item fresh when it runs.

### Placeholders

A planned action defined now with its kinds and permission, answering "not built yet" to
everyone. Surfaces and agents see it with that reason; `run` is unreachable. Replacing it with
the real one changes nothing for callers. An assistant's allow-list never includes placeholders.

### Ports

An action that reaches the platform through something the app connects (real data, a job
reader) declares it. Until connected, it is dimmed "not connected" and refused. Wiring decides
availability; there is no second "is this configured?" check scattered across screens.

### Agent adapters

- One registry, many adapters (in-app assistant, MCP server, WebMCP bridge, CLI). Each registers
  an explicit allow-list, so exposing one more action is a reviewed change in one place.
- Adapters hold no logic: definition → tool, tool call → `runAction` with an agent caller, result
  back unchanged.
- Agents see everything they may call, with its state and reason, so they can plan.
- An agent in the browser usually cannot be identified. Limit it by grant (time-limited, scoped
  consent, or a revocable token for a server agent), never by a secret held in the page.

## Decisions the project makes

This reference does not pick these. Ask, offer the common answers, and record the choice in
project steering.

| Question | Common answers |
|---|---|
| What is an action here? | § Is it an action?, plus the project's own list of borderline cases |
| Where are permissions resolved? | The platform's roles; the app's own role table; a policy engine. Server-side for anything that writes |
| Where are audit records kept? | An append-only table; the platform's audit API; a log pipeline. Decide retention |
| How is a person's click proven to the server? | A token minted on a person's gesture; a second request the server pairs with the first; the platform's own confirm step |
| Which actions may outside agents call? | None by default; a reviewed allow-list per adapter; per-grant scopes |
| What counts as costly, public, destructive? | The project's own list with examples. Unsure → it needs a click |

## Adding an action

1. **Search the registry.** Widen an existing action before adding one (SKILL rule 1).
2. **Name the contract** `run` uses. Missing → change the contract first (`contracts.md`).
3. **Write the metadata first:** id, title, description, input, kinds, permission, flags.
   Unsure whether it needs a click → it does.
4. **Blocking rules are rows** in the conditions table, never an `if` in `run`.
5. **Words go in the words file.**
6. **Write `run` against `deps` only.**
7. **Add it to the registry.** Surfaces place it by id; they never re-implement it.
8. **Tests for the rules first,** then the surface.
9. **Exposing it to an agent** is a separate, reviewed change to that adapter's allow-list.

Not ready to build it? Define it as a placeholder, if the project uses them.

## Anti-patterns

- A click handler that does more than call `runAction`.
- An agent tool list kept beside the action list.
- Disabled logic in a component instead of `availabilityOf`.
- Hiding an action because it does not apply now.
- A reason built from an error message or API data.
- Retrying a request that bills.
- Calling client-side checks security while the server trusts the client.

## Tests

- **Definitions:** every registered action passes the load-time check. A costly action without a
  click, an unsupported schema keyword, an open object or an undescribed property is refused.
  Metadata survives serialization unchanged.
- **Running:** one test per refusal, each resolving (never throwing) with its fixed reason and
  writing exactly one audit record.
- **Agents:** refused every click-required action; a malformed caller is treated as an agent; a
  proposer is kept only when a person runs an agent's proposal.
- **Availability:** partial fits and blocking conditions give the right state, reason and count;
  the same answer for a person and an agent.
- **Extensions, where present:** a billed request is never resent after a 5xx or no answer; a
  batch pass writes one record with previous values; only allow-listed actions reach an adapter.
- **Boundary, once a server exists:** a write without a verified session, the permission or a
  verified click is refused server-side, even when the client claims to be a person.
