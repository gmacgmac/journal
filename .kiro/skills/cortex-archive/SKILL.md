---
name: cortex-archive
description: "Retire or supersede content \u2014 move it into cortex/.archive/ with a dated header. Use when explicitly archiving/retiring a file, or when cortex-docs retires a doc. NOT a pre-edit snapshot tool \u2014 git is the history."
---

# Archive

Move a file into `cortex/.archive/` when it is retired or superseded, invoked by the `router.md`
retire/delete safety route or by `cortex-docs`.

> **Not a pre-edit snapshot tool.** Nothing is archived before a change — git is the history.
> Archive only content that is leaving its location for good.

## Inputs

- **Source file**: the file to archive.
- **Archive reason**: one of `superseded`, `retired`, `completed`, `obsolete`.
- **Replacement** (optional): the file that replaces this one.

## Archive reasons

| Reason | When |
|--------|------|
| `superseded` | A new file replaces this one |
| `retired` | No longer needed |
| `completed` | One-time task finished |
| `obsolete` | Factually outdated |

## Location

Destination: `cortex/.archive/[YYYY]/`

## File naming

`[YYYY-MM-DD]-[reason]-[original-filename].md`

## Execution steps

1. **Validate source**: confirm the file exists.
2. **Ensure archive folder**: create `cortex/.archive/[YYYY]/` if missing.
3. **Move** the file (original removed from its location).
4. **Prepend header** to the archived copy:
   ```
   > **Archived**: [YYYY-MM-DD] | **Reason**: [reason] | **Replaced by**: [replacement or "n/a"]
   ```
5. **Log**: append entry to `LOG.md` recording the archive action.

## Validation

- Archived file exists at the expected path in `cortex/.archive/[YYYY]/`.
- Header is present at top of archived file.
- Original is removed.
