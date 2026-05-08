# CLAUDE.md

Operational guidance for working in this repository.
This file is auto-loaded; it's the orientation for every session.

## Read this first

The canonical project documentation is the castle at [`docs/`](docs/).
Start with [`docs/map.md`](docs/map.md) — it's the entrance hall and lists the wings, the projects, and the conventions that apply across all of them.

For project-specific work, descend into the relevant project castle:

- `@cqrs-toolkit/client` → [`docs/projects/client/`](docs/projects/client/_overview.md)
- `@cqrs-toolkit/client-electron` → [`docs/projects/client-electron/`](docs/projects/client-electron/_overview.md)
- `@cqrs-toolkit/client-solid` → [`docs/projects/client-solid/`](docs/projects/client-solid/_overview.md)
- `@cqrs-toolkit/devtools` → [`docs/projects/devtools/`](docs/projects/devtools/_overview.md)
- `@cqrs-toolkit/hypermedia` → [`docs/projects/hypermedia/`](docs/projects/hypermedia/_overview.md)
- `@cqrs-toolkit/hypermedia-cli` → [`docs/projects/hypermedia-cli/`](docs/projects/hypermedia-cli/_overview.md)
- `@cqrs-toolkit/hypermedia-client` → [`docs/projects/hypermedia-client/`](docs/projects/hypermedia-client/_overview.md)
- `@cqrs-toolkit/realtime` → [`docs/projects/realtime/`](docs/projects/realtime/_overview.md)
- `@cqrs-toolkit/schema` → [`docs/projects/schema/`](docs/projects/schema/_overview.md)
- Demo system → [`docs/projects/demo/`](docs/projects/demo/_overview.md)

When you're working in `packages/<pkg>/`, read that package's local `CLAUDE.md` for any package-specific operational specifics, then operate within the project's castle.
This is the **handoff rule**: orient at the repo level, descend to the project, work locally.

For repo-wide conventions — type system, error handling, code style, design pitfalls, testing — read the relevant pattern doc in [`docs/patterns/`](docs/patterns/).

## Build & development commands

```bash
# Install dependencies
npm i

# Build emitting packages and type-check all workspaces
npm run build

# Run all unit tests (single run)
npm run test:run

# Run a specific test file
npm run test:run -- packages/<pkg>/src/<file>.test.ts

# Run all e2e tests (from repo root)
npm run test:e2e

# Format git-changed files (removes unused imports, enforces style)
npm run format

# Generate API docs for all packages (outputs to each package's docs/api/)
npm run docs
```

**Always use `npm run build` to check for TypeScript errors.**
Do not use ad-hoc commands like `npx tsc` — they will fail or produce incorrect results due to the monorepo structure.

**`npm run format` formats only git-tracked, git-changed files.**
After creating new files, `git add` them first so the next `npm run format` includes them; untracked files are skipped by the diff filter.
Do not invoke `npx prettier` directly, and do not use `npm run format:all`.

## Task completion checklist

Before marking any task complete, run these in order:

1. `npm run format` — after all edits.
2. `npm run build` — fix any type errors before continuing; never use `as`, `!`, or `any` to silence them.
3. `npm run test:run` — or a targeted test if scope is clear.

Do not skip steps.
Do not substitute ad-hoc commands.

## Behavioural rules

These are rules for the agent, not just for the codebase.

### Don't modify `exports` or `imports` in any `package.json` without explicit instruction

These fields define each package's public API surface.
Adding a new entry expands the public API; changing one restructures cross-package resolution.
Both are design decisions, not implementation details — surface as a question rather than acting.

See [`docs/patterns/package-boundaries.md`](docs/patterns/package-boundaries.md).

### Use `npm i` for dependencies, not manual `package.json` edits

Run `npm i {pkg}` or `npm i {pkg}@{version}` (with `-D` for devDependencies, `-w {workspace}` for monorepo targeting).
Do not hand-edit version strings in `package.json` — npm resolves the correct version and updates the lockfile atomically.

### Stop on test failure; diagnose and report before fixing

If tests fail during verification, stop.
Do not guess a fix and apply it.
Trivial fixes (typos, missing imports) can proceed without asking; anything involving logic or architecture stops, diagnoses the root cause, presents findings, and waits for direction.

### Don't make design changes without asking

Design changes — performance trade-offs, architectural patterns, API contracts — belong to the user.
A bug fix that requires changing the design is not "just a bug fix"; stop and explain the options before editing.

### Maintain the castle as you work

The castle ([`docs/`](docs/)) is the canonical source of project knowledge — intent, decisions, evolution, conventions.
When work produces something castle-worthy — an architectural decision, a requirement change, a meaningful evolution entry, a new normative convention, a recurring procedure, a new analytical framing — write it to the castle in the same session.
Reasoning fades fast; the cost of capturing it now is much lower than reconstructing it later.

The full when-to-write-what guide is in [`docs/map.md`](docs/map.md) under "Maintenance habits."
At minimum:

- An accepted ADR is immutable; never edit one except to add a "Superseded by ADR-NNNN" back-pointer.
- Date everything (ISO YYYY-MM-DD).
- Run `scripts/audit-links.sh` after editing the castle to verify no broken links.
- When uncertain where something belongs, ask before writing — wrong placement teaches future sessions the wrong pattern.
- If a task conflicts with the castle, surface the conflict (see below) rather than silently overriding.

When unsure whether something is castle-worthy: ask, or default to capturing it.
Most session-state-of-mind context decays within hours.

## Conflict handling

When the castle and a task disagree, surface the conflict.
"This change would violate ADR-NNNN's constraint that X; do you want to update the decision, or should we approach this differently?" is the correct response.
The castle is useless if its contents get silently overridden.

## Repo-wide conventions

The substantive content for repo-wide conventions lives in [`docs/patterns/`](docs/patterns/).
Index:

- [`type-system.md`](docs/patterns/type-system.md) — strict-types philosophy, no escape hatches, generic threading, `undefined` over `null`.
- [`error-handling.md`](docs/patterns/error-handling.md) — `Result<T, E>` for domain failures, `assert` for bugs, `throw` for external errors.
- [`structural-honesty.md`](docs/patterns/structural-honesty.md) — explicit structures over hidden ones (no fire-and-forget, no boolean state machines, etc.).
- [`design-pitfalls.md`](docs/patterns/design-pitfalls.md) — taxonomy of design mistakes to avoid.
- [`code-style.md`](docs/patterns/code-style.md) — file org, naming, import discipline, function-vs-arrow.
- [`documentation-style.md`](docs/patterns/documentation-style.md) — markdown discipline, JSDoc `{@link}` for type refs, comment guidelines.
- [`testing.md`](docs/patterns/testing.md) — test-files-beside-source, bug-fix workflow, stop-on-failure.
- [`package-boundaries.md`](docs/patterns/package-boundaries.md) — public-API surfaces are deliberate.

The repo-wide ADRs that justify these patterns are in [`docs/decisions/`](docs/decisions/).
