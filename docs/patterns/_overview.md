# patterns/

How things are done here (construction).
Normative repo-wide conventions for *action* — coding style, type-system rules, error-handling shape, doc-comment style, build/test workflow.
A pattern says "use Result<T, E>" or "name readonly arrays as `readonly T[]`."

## Patterns

- [`code-style.md`](code-style.md) — formatting, file/dir naming, import discipline, function vs arrow.
- [`design-pitfalls.md`](design-pitfalls.md) — taxonomy of design mistakes to avoid.
- [`documentation-style.md`](documentation-style.md) — markdown discipline, JSDoc `{@link}` for type refs, comment guidelines.
- [`error-handling.md`](error-handling.md) — `Result<T, E>` for domain failures, `assert` for bugs, `throw` for external/library failures.
- [`package-boundaries.md`](package-boundaries.md) — `package.json` `exports`/`imports` are deliberate public-API surfaces.
- [`structural-honesty.md`](structural-honesty.md) — explicit structures over hidden ones; no fire-and-forget, no boolean state machines.
- [`testing.md`](testing.md) — test-files-beside-source, bug-fix workflow, stop-on-failure.
- [`type-system.md`](type-system.md) — strict types; no `any` / `as` / `!` escape hatches; generic threading; `undefined` over `null`.

## Distinguished from neighbours

- **vs. `decisions/`**: an ADR is a single immutable choice with rationale; a pattern is the ongoing convention that follows from one or more decisions.
  Multiple ADRs may collectively justify a pattern.
- **vs. `playbooks/`**: a pattern is a convention for action *in context*; a playbook is a sequenced procedure for a *recurring activity*.
- **vs. `mindset/`**: a pattern is prescriptive about action ("use X"); a mindset is prescriptive about analysis ("when faced with problem-class Y, reason like Z").

## Scope

Repo-level patterns apply across all packages.
A project (e.g. `docs/projects/demo/`) grows its own `patterns/` wing when it has project-scoped normative conventions that don't apply outside that project.
The level is not a default — it's a scope statement.

## Pattern entry shape

Each pattern is one file: `<pattern-name>.md`.
Suggested structure:

- The convention itself (what to do).
- Rationale or pointer to the ADR(s) that established it.
- Where applied (which packages or projects, with any deviations linked to project-local ADRs).
- Exceptions and known issues.

## Promotion

A project-scoped pattern adopted repo-wide is promoted by `git mv` to this wing — patterns are mutable, so the file moves rather than duplicates.
For the procedure, see [`/docs/playbooks/promoting-castle-content.md`](../playbooks/promoting-castle-content.md).
