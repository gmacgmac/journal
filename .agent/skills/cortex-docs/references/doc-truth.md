# Keeping Docs True With Tests

The goal: a change that makes a doc claim false fails a test, not a reader. Drift is caught at
write time, by the suite, so nothing has to re-read docs afterwards.

## The mechanism shape

A doc that describes how something works uses four parts per mechanism:

```markdown
### [Mechanism name]

**Property** — what is true, in one or two sentences.
**Where** — `path/to/file.ext` (`symbolName`), one per implementing symbol.
**Proven by** — `path/to/file.test.ext` (`test name`).
**Not covered** — the honest gaps no test holds. "None" only if that is true.
```

The `###` heading is the mechanism's name, and that name is the join key for the tripwires
below. **Not covered** is where review effort goes; never leave it out to look complete.

## Index + tripwires (the three-way check)

For any doc that lists mechanisms or conventions (security, API conventions, permissions):

1. **An index constant in code** — one row per mechanism: `name` (the exact `###` heading),
   `symbol` (`path#symbol`, comma-separated), and `test` (the file that holds it). Only tests
   read it; it is not served or imported at runtime.
2. **One registered test block per row**, keyed by the same name.
3. **Tripwire tests**, comparing names in all three directions:
   - every index row has a `###` heading in the doc, and every heading has a row;
   - every index row has a test block, and every test block has a row;
   - names are unique.
4. **A symbol-existence test** — every `path#symbol` the index names still exists in its file
   (word-boundary match). A rename now breaks the build instead of silently staling the doc.
5. **A test-file-existence test** — every test file a row cites exists.

Add a mechanism → a row, a heading and a test block in one change, or the suite fails.

Shape, in outline:

```ts
// mechanisms.ts — index of SECURITY.md (read by tests only)
export const MECHANISMS = [
	{ name: 'Loopback bind', symbol: 'src/config.ts#loadConfig', test: 'src/config.test.ts' },
] as const;

// mechanisms.test.ts
const registered = new Map<string, () => void>();
function mechanism(name: string, fn: () => void) { registered.set(name, fn); test(name, fn); }

mechanism('Loopback bind', () => { /* assert the property over real code */ });

test('rows, headings and blocks agree', () => {
	const rows = MECHANISMS.map((m) => m.name).sort();
	const headings = [...readFileSync('SECURITY.md', 'utf8').matchAll(/^### (.+)$/gm)].map((m) => m[1].trim()).sort();
	assert.deepEqual(rows, [...registered.keys()].sort());
	assert.deepEqual(rows, headings);
});
```

### Check every member when you can, not just the listed ones

An index cannot notice a mechanism nobody listed — a new guard with no row passes every
tripwire. State that limit in the index's header so nobody over-trusts it.

Where the things are **enumerable** (every route in a served spec, every component in a folder,
every settings group), assert the convention over **all** of them, not a fixture. A new member
is then held to the rule the moment it exists. What can't be enumerated stays a review question
— and the VERIFY task asks it (below).

### Test absences too

When a doc says something is **not** provided, assert the absence. When it lands, the test and
the doc's line change in the same commit.

## Other claims a test can hold

| Claim in a doc | Test |
|---|---|
| A number (a default limit, a size) | Derive it from the real constant; never hard-code the answer |
| A UI path ("Settings › System › Engine") | It resolves to a real settings group / route |
| "Every component is in the pattern gallery" | Each component file has a gallery row, and each row a component |
| A command in a README | It exists in the project's scripts |
| A `path` + `symbol` reference | The symbol exists in that file |

## What never goes in a durable doc

- **Line numbers.** Cite `path` + `symbol`.
- **Current state** — counts, pass totals, progress, what has landed. It moves daily and a stale
  copy gets believed. Point to where it is derived (the tracker, the test output).
- **Quoted decisions or tracker rows.** Cite the id (`D-012`, tracker `N33`). Decisions live in
  an append-only register: one entry each, superseded by a new entry, never edited.

## The VERIFY task's doc audit

Every task set that changes code a doc describes ends with these checks in its VERIFY task:

1. **Claim audit** — list each doc claim the change touched; each now has a symbol and a passing
   test, a new test, or was deleted.
2. **Unindexed check** — did the change add a mechanism, convention, number or component that no
   index lists? If yes, add the row (and its heading and test) now.
3. **Run the suite** — the tripwires are part of it.

## When there is no test suite

The method needs one. Without it: keep doc claims minimal, mark each mechanism
`Not covered: no test suite`, and log one `[needs-human-input]` recommending a suite. Do not
present an untested claim as verified.
