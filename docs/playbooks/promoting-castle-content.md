# Promoting castle content to a higher scope

Procedure for moving a pattern, mindset entry, playbook, or ADR from a project scope to a higher (cross-cutting) scope when it proves applicable beyond its original boundary.

## Purpose

Keep the castle's scope claims honest as content matures.
A pattern that started demo-specific may turn out to be repo-wide; a project-level ADR may apply to several packages.
Promotion makes that explicit instead of leaving inconsistent duplicates or implicit broadening.

## Trigger

You've identified that a piece of content currently scoped at a project level is applied (or is about to be applied) across enough projects that it deserves to live at the higher scope.

Promotion is _deliberate, not speculative_.
Triggers worth acting on:

- Two or more projects independently adopt the same convention / decision / framing.
- A new project explicitly adopts an existing project's pattern, and you'd otherwise duplicate the doc.
- Cross-package work makes a previously project-internal procedure relevant repo-wide.

If the content is "this might generalize someday" rather than "this clearly applies at the higher scope already" — wait.
Premature promotion abstracts away project-specific rationale that should still apply.

## Prerequisites

- The current location of the content (project-scoped path).
- The target location (higher-scoped path).
- Evidence that the content applies at the higher scope — the actual existing applications, not hypothetical ones.

## Wings that promote

| Wing         | Promotion mechanic                                                                                                   | Notes               |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `decisions/` | Write a _new_ ADR at the higher scope; cite the original; back-pointer in the original. The original stays in place. | ADRs are immutable. |
| `patterns/`  | `git mv` to the higher-scope `patterns/`; edit content for new scope.                                                | Mutable.            |
| `mindset/`   | `git mv` to the higher-scope `mindset/`; edit applicability.                                                         | Mutable.            |
| `playbooks/` | `git mv` to the higher-scope `playbooks/`; edit steps to drop project-specific scope.                                | Mutable.            |

## Wings that do not promote

- `intent/` — vision, requirements, non-goals, glossary are scoped to the level they describe.
  A repo-level vision doesn't "absorb" a project-level requirement; they describe different things at different times.
- `evolution/` — changelogs, milestones, deprecations are timestamped records of what happened at the scope they record.
  Project and repo evolution coexist; they don't promote.

## Steps

The mechanic depends on whether the wing is mutable or immutable.

### A. Mutable wings (`patterns/`, `mindset/`, `playbooks/`)

1. **Verify the higher-scope claim.**
   List every project where the content currently applies.
   If only one applies and the others "could but don't yet," wait.

2. **`git mv` the file** to the higher-scope wing.
   Examples:
   - `docs/projects/demo/patterns/foo.md` → `docs/patterns/foo.md` (demo-scoped → repo-wide)
   - `docs/projects/client/mindset/bar.md` → `docs/mindset/bar.md` (client-scoped → repo-wide)
   - `docs/projects/client/playbooks/baz.md` → `docs/playbooks/baz.md`

3. **Edit the moved file for the new scope.**
   - Rewrite "Where applied" to list the projects that actually apply the content at the higher scope.
   - Generalize examples that were project-specific.
   - Drop project-specific rationale that no longer applies broadly.
   - Update any internal cross-links so the relative paths resolve from the new location.

4. **Find and update any references to the old path** in other docs.
   `npm run docs:audit` will catch broken links; fix each one.

5. **Append a changelog entry** to the originating project's `evolution/_overview.md` _and_ the destination's `evolution/_overview.md` (typically the repo-level one).
   Each entry should reference the other.

6. **Run `npm run docs:audit`** to confirm no broken links.

### B. Immutable wing (`decisions/` — ADRs)

ADRs are immutable.
Promotion produces a _new_ ADR at the higher level rather than moving the existing one.

1. **Write a new ADR** at the higher-scope `decisions/` (e.g., new `docs/decisions/NNNN-foo.md`).
   - The new ADR's Context cites: "Promoted from `docs/projects/<pkg>/decisions/MMMM-foo.md`."
   - The new ADR may incorporate refinements from the broader applicability — it's a fresh artifact, not a copy.

2. **Add a back-pointer** to the original ADR.
   In the original `docs/projects/<pkg>/decisions/MMMM-foo.md`, add a line above the Status field:

   ```markdown
   **Generalized by ADR-NNNN (YYYY-MM-DD)** at `/docs/decisions/NNNN-foo.md`.
   ```

   This and the supersession back-pointer are the only legitimate post-acceptance edits to an ADR.

3. **Update referencing docs** to point at the appropriate ADR — usually the new repo-level one, sometimes both for nuanced cases.

4. **Append a changelog entry** to the originating project's `evolution/_overview.md` _and_ the repo-level `evolution/_overview.md`.

5. **Run `npm run docs:audit`** to confirm no broken links.

## Verification

```bash
npm run docs:audit
```

Plus visual sanity checks:

- The moved/new file's "Where applied" or Context section accurately reflects the higher-scope picture.
- The original location either physically moved (mutable wings) or has the back-pointer (immutable wing).
- Both relevant changelogs have entries describing the promotion and pointing at each other.

## Rollback

If the promotion turns out to be premature (only one project actually applies the content):

- **Mutable case:** `git mv` back to the original location, revert the content edits, append "Demoted: only one project applies; promotion was premature" to the changelog at both levels.
- **Immutable case:** the new higher-level ADR cannot be deleted (ADRs are immutable).
  Write a superseding ADR at the higher level with rationale for why the broader scope claim was wrong; status the promoted ADR as "Superseded by ADR-NNNN."
  The original project ADR's "Generalized by..." pointer stays as a historical breadcrumb to the superseded artifact.

Don't silently undo a promotion — the misadventure is itself institutional knowledge.

## Notes

- **Second-occurrence-rule status:** this playbook was written before the first real promotion event in this monorepo.
  Steps are derived from existing wing conventions (immutable ADRs, mutable patterns/mindset/playbooks) plus the broader memory-palace promotion principle.
  Expect refinement after first real use.
