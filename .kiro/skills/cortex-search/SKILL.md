---
name: cortex-search
description: "Find existing docs or code with the layered search (doc surface \u2192 filename \u2192 content \u2192 frontmatter \u2192 tests). Use before creating anything to avoid duplicates, or whenever asked to locate a file, doc, or definition."
---

# Search

Layered search algorithm for finding documentation and code. Try layers top-to-bottom; stop when you have sufficient results. Use your environment's dedicated file and content search tools; shell `grep`/`find` only when none exist.

## Layers

| Layer | Method | Use When |
|-------|--------|----------|
| 1 | DOC_SURFACE | Always first — scope to declared doc folders (`REGISTRY.md` docs) |
| 2 | FILE_DISCOVERY | Need broader filename/path coverage |
| 3 | CONTENT_SEARCH | Need specific terms/patterns inside files |
| 4 | FRONTMATTER_SEARCH | Auto-detected when docs carry frontmatter |
| 5 | TEST_COVERAGE | Need to verify tests exist for a feature |

---

## Layer 1: DOC_SURFACE

Scoped lookup — confine the search to the declared doc surface.

1. Read `REGISTRY.md` `docs` — `include` + `flag` are the doc surface; drop anything matching `exclude`.
2. List doc files within those paths.
3. Read the file(s) most relevant to the search topic.

**Fall through when**: doc-surface folders hold nothing relevant, query spans multiple domains, or need implementation details not in docs.

## Layer 2: FILE_DISCOVERY

Filename and path matching — find docs by where they live and what they're named.

1. Search by filename pattern, scoped to the doc surface by default (broaden only during deep ripple scan).
2. Match filenames against the search topic.
3. Check known documentation paths from `REGISTRY.md` docs (and `cortex-tasks/` for historical context).
4. Read promising files based on name relevance.

## Layer 3: CONTENT_SEARCH

Full-text search inside files for specific patterns.

1. For docs: search file contents within the doc surface.
2. For code: search the project's source paths, filtered by file type.
3. Read matching files for context.

## Layer 4: FRONTMATTER_SEARCH (auto-detected)

Metadata-driven search — scan document frontmatter for structured categorization. Used automatically when discovered docs carry frontmatter (`keywords`, `scope`, `type`). No toggle needed.

1. Scan relevant doc-surface folders for files with frontmatter.
2. Parse frontmatter fields and match against the search query.
3. Rank results by keyword overlap and scope relevance.

**Engages automatically** when docs have frontmatter. To "enable" it, simply add frontmatter to your docs.

## Layer 5: TEST_COVERAGE

Check if tests exist for a feature or component.

1. Find test files by the project's naming convention (e.g. `*.test.*`, `*.spec.*`, `test_*.py`).
2. Search those files for the feature's symbol or name.

Use before claiming test coverage exists, when verifying a change has test backing, or investigating a bug.

---

## Scope rules

- Doc paths come from `REGISTRY.md` docs (the declared doc surface).
- Source/test paths are project-specific (category paths in `REGISTRY.md`).
- `cortex-tasks/` provides historical task context — readable, though `exclude`d from drift checks.
