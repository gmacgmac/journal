# Research Task Variant

When the task `type` is `research`, apply these format changes:

**Frontmatter**: Add `type: research` and `research_category: [categories]`.

**Filename**: Include `research` — `cortex-tasks/{concern}/{date}_{category}_research_{title}.md`

**Required sections** (in order):
1. Banner: `> **RESEARCH ONLY — DO NOT implement.**`
2. Problem Statement
3. Research Objectives (RO-1, RO-2, ... with specific questions)
4. Steps (read/grep/trace actions to satisfy objectives)
5. Files Involved table (read-only inputs, not files to modify)
6. Constraints (must include "DO NOT modify any source file")
7. Success Criteria (checkboxes, mapped to ROs)
8. Deliverables: task file updated with findings + `{filename-stem}_result.md`
9. References
10. Implementation Notes (empty: Completed, Changes Made, Issues, Research Findings)

**Key rule**: Research produces findings, not implementations. If it should also output a ready-to-execute task file, state that in Deliverables explicitly.
