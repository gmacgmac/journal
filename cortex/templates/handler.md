# Handler: [Name]

> **Version**: 1.0 | **Created**: [DATE]  
> **Trigger**: `REGISTRY.md` → Category: `[category]`

---

## Context Analysis

*   **Goal**: [Brief description of what this handler achieves]
*   **Inputs**:
    *   [Source File 1]
    *   [Source File 2]

---

## [Semantic Section Name]

<!-- Use descriptive section names that convey meaning -->
<!-- Examples: "Classification Matrix", "Archive Reasons", "Execution Steps" -->
<!-- Use as many sections as needed - no fixed number required -->

1.  **[Step or subsection]**
    *   [Instruction]
    *   [Instruction]

2.  **[Another step]**
    *   [Instruction]

---

## [Another Semantic Section]

<!-- Continue with as many sections as the handler needs -->

---

## Mode-Aware Logic

> [!NOTE]
> Check `cortex/PROFILE.md` §1 for `system_mode` before processing.

*   **Learning Mode**: Propose new structures via Collaborative Resolution Protocol.
*   **Production Mode**: Enforce existing structure; flag mismatches.

---

## Validation / Close Loop

*   **Verification**: [How to check if it worked]
*   **Record the work in `cortex/LOG.md`** — one line, terminated with a newline, append-only:
    ```
    [[YYYY-MM-DD HH:MM]] [category] Description → <trail per cortex-change-protocol>
    ```
*   **Never write `cortex/AUDITED.md`, and never remove a LOG entry.** AUDITED is
    `cortex-garden`'s ledger — it records what has been *verified*, and only the Gardener verifies.
    A handler dispatched by the Gardener reports its outcome back to the Gardener, which writes the
    checkpoint and does the LOG cleanup.

---

## Template Guidelines

### Required Elements (Guard Rails)
1. **Metadata block** - Must include Version, Created, and Trigger
2. **Context Analysis** - Must be first section with Goal and Inputs
3. **Mode-Aware Logic** - Consult PROFILE §1 (switches) before processing
4. **Validation / Close Loop** - Must be final section with verification and logging

### Flexible Elements
- **Section names** - Use semantic, descriptive names (not numbered "Process Steps")
- **Section count** - As many as needed for clarity
- **Section structure** - Organize logically for the specific handler
