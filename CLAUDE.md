# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A published npm package monorepo providing shared CQRS client and server utilities.
TypeScript monorepo using npm workspaces.
Packages are scoped under `@cqrs-toolkit/*`.

Each package is generally **client-only or server-only**, not both.
Some packages depend on `@meticoeus/ddd-es` for core DDD/ES types (events, aggregates, etc.).

## Development Status: Pre-Release

This project is under active development prior to initial release.

**Implications for development:**

- **No backwards compatibility concerns**: Breaking changes are acceptable during this phase.
- **API surface is not finalized**: Exports, type signatures, and package boundaries may change freely.

## Build & Development Commands

```bash
# Install dependencies
npm i

# Build emitting packages and type-check all workspaces
npm run build

# Run all unit tests (single run)
npm run test:run

# Run specific test file
npm run test:run -- packages/<pkg>/src/<file>.test.ts

# Format changed files (removes unused imports, enforces style)
npm run format

# Generate API docs for all packages (outputs to each package's docs/api/)
npm run docs
```

**Important:** Always use `npm run build` to check for TypeScript errors.
Do not use ad-hoc commands like `npx tsc` — they will fail or produce incorrect results due to the monorepo structure.

**Formatting:** Run `npm run format` after finishing a batch of file edits.
This formats only git-changed files — it removes unused imports, enforces consistent style, and catches issues like stale references.
Do not use `npm run format:all`.

## Package Boundaries

Do not add, remove, or modify `exports` or `imports` fields in any `package.json` without explicit instruction.
These mappings control the public API surface of each package and affect how TypeScript resolves cross-package imports.

## Monorepo Structure

```
packages/              # All workspace packages
packages/tsconfig.common.json  # Shared strict TypeScript config for packages
```

Each package:

- Extends `packages/tsconfig.common.json`
- Uses `"type": "module"` (ESM)
- Exports via `exports` field with `types` and `import` conditions
- Builds with `tsc` to `dist/`

## Type System Philosophy

The type system is the primary tool for preventing bugs at compile time.
When you encounter a type error or an awkward type situation, treat it as a design signal — investigate the root cause and fix the types so the compiler catches mistakes now and in the future when someone changes something.
Never silence the compiler with escape hatches (`as`, `!`, `?? fallback` on required fields, `any`).
Each escape hatch is a hole in the safety net: the compiler stops tracking that value, and future changes that would have produced a helpful error instead silently introduce bugs at runtime.
The default response to a type problem should be "how do I restructure this so the types work correctly?" — not "how do I make the compiler stop complaining?".

Specific rules:

- **Prefer the most specific type that is practical.**
  Use generics, discriminated unions, and type predicates to preserve type information through call chains.
  Do not widen to a base type unless the consumer genuinely does not care about the specific type.
  When a function produces a specific type, design its signature so callers receive that specific type.
- **`noUncheckedIndexedAccess` is enabled.**
  Array indexing like `arr[0]` returns `T | undefined`, not `T`.
  Always handle potential undefined values with optional chaining (`arr[0]?.prop`), nullish coalescing (`arr[0] ?? default`), or explicit checks.
- **Every object literal must be type-constrained at its construction site** — through a type annotation on the variable, a typed function parameter, or a generic factory.
  An untyped object literal opts out of the type system: the compiler cannot verify it matches the intended shape, and when that shape changes later, the literal silently produces malformed data at runtime.
  If you don't know what type an object should be, that's a design problem to solve, not a reason to skip the annotation.
- **Do not use `as` type assertions to silence TypeScript errors.**
  Explore the root cause and fix the types so things remain strongly typed.
  If after exploration it is unreasonably difficult to strictly type something, find the least hacky option and add a comment explaining why the cast is necessary.
  Mock setup in unit tests (e.g., `as unknown as SomeType`) is the one context where casts are self-explanatory and don't require justification.
- **Do not use `!` non-null assertions.**
  If a value could logically be undefined, restructure so the type guarantees its presence (e.g., carry the value through a result type instead of re-finding it).
  If the value truly cannot be undefined, the types should already reflect that — a `!` means the types are wrong, not that you need an escape hatch.
- **Do not use `?? fallback` or `?.` on values whose type guarantees they are present.**
  If the type says a field is required, trust it — adding a fallback silently masks bugs by converting what should be a crash into incorrect data.
  If you are unsure whether a value can be undefined, check the type definition; do not add a fallback "just in case".
- **Use `typeof x !== 'string'` for narrowing guards, not `x === undefined`.**
  When checking an untyped value extracted from a `Record<string, unknown>` or similar, prefer `typeof x !== 'string'` over `x === undefined`.
  This both narrows the type and validates the expected shape in a single check.

## Error Handling Strategy

This project follows the error handling model used by Rust, Go, and Erlang — not JavaScript's convention of throwing exceptions for everything.
Throwing conflates bugs with expected failures, making it impossible for callers to know which errors to handle and which indicate broken code.

Three error categories, each with a distinct mechanism:

1. **Expected domain failures** — `Result<T, TypedException>` (Rust-style).
   Business rule violations, validation errors, permission denials.
   Return a typed `Result` with an appropriate domain exception (existing or a new one); never thrown.

2. **Code bugs / invariant violations** — `assert` from `node:assert`.
   Conditions that must hold if the code is correct (exhaustive switches, impossible states, missing config).
   An `AssertionError` means a developer needs to fix something.

3. **External / library failures** — thrown `Error`.
   Database connection lost, S3 timeout, third-party SDK exception.
   Infrastructure code catches these at the boundary and either translates them to domain results (category 1) or lets them propagate as unrecoverable.

**Rule of thumb:** if the failure means "we have a bug", use `assert`.
If it means "the outside world did something unexpected", throw or propagate an `Error`.
If it means "the user/caller asked for something the business rules don't allow", return a typed `Result`.

## Testing

Unit tests use Vitest and test logic in isolation.
Test files live beside the source files they test (e.g., `routes.ts` → `routes.test.ts`).
This applies to all test types: unit tests, integration tests, and e2e tests.

```bash
# Run all unit tests (single run)
npm run test:run

# Run specific test file
npm run test:run -- packages/<pkg>/src/<file>.test.ts

# Run all e2e tests (from repo root, not from the demo directory)
npm run test:e2e
```

### Bug Fix Workflow

When fixing a non-trivial bug, follow this sequence:

1. **Reproduce first.**
   Write a test that exercises the broken behavior through the public API.
   The test should assert the correct contract — what the code _should_ do — so it fails against the current (buggy) implementation.
2. **Verify the test fails.**
   Run it and confirm the failure matches the reported symptom.
   If the test passes, it does not reproduce the bug — revisit your understanding before proceeding.
3. **Implement the fix.**
4. **Verify the test passes** and all existing tests still pass.

A unit test is preferred when the bug is in a single module's contract.
Use an e2e test only when the bug requires multi-component interaction that a unit test cannot capture.
Skip this workflow for trivial fixes (typos, missing imports, config tweaks) where a regression test adds no value.

## Demo App (`demos/todo-demo`)

The demo app serves four goals, all equally important:

1. **Demonstrate effective client usage.**
   The demo is a reference implementation showing best practices and patterns that promote performance in a larger application.
   Components should follow the same patterns a real consumer would use.
   If the demo code looks awkward or fragile, that is a signal the library API needs improvement, not a reason to add workarounds.

2. **End-to-end test the library.**
   The demo exercises the full public API and stated goals of the library under realistic conditions.
   E2e tests cover single-session, multi-session, with and without WebSocket propagation.
   Every user-facing library feature should have e2e coverage through the demo.

3. **Keep e2e tests simple and readable.**
   Tests should be easy to read and understand at a glance.
   Use dedicated CSS classes as stable selectors (e.g., `.note-item`, `.dash-note-title`) rather than fragile DOM structure queries.
   Extract reusable test actions and assertions into `e2e-helpers.ts`.

4. **Maintain strong debuggability.**
   When something breaks — in automated tests or manual testing — the cause should be easy to identify.
   This includes useful logging, the command inspector page, observable client state, and clear loading/error states in the UI.
   Prefer surfacing internal state visually (CSS classes for loading states, status indicators) over hiding it.
   New debugging features (e.g., additional inspector pages, state visualizations) are welcome when they serve this goal.

## Code Style

### File Organization

Organize code in this order:

1. **Imports** - External and internal dependencies
2. **Private constants** - Only constants go here since they are not hoisted and are important to keep visible at the top
3. **Public interface** - Exported types, interfaces, classes, and functions
4. **Private implementation** - Internal helper functions, unexported types, and implementation details

**Test files** (`.test.ts`) treat the test blocks as the public interface.
Organize test files in this order:

1. **Imports**
2. **Constants** - Dummy IDs, fixed values
3. **Tests** - `describe`/`it` blocks
4. **Helpers** - Utility functions used across multiple tests

### Import Renames

Do not use `import { x as y }` to rename exports.
If an export name would collide with another import, the export itself should have a scoped, unambiguous name.

The only acceptable use of `as` is for external libraries where you don't control the export name (e.g., `import { v4 as uuid } from 'uuid'`).

### Function Style

Prefer `function` declarations over arrow functions.
Arrow functions are acceptable in these cases:

- Typed callbacks: `const handler: RequestHandler = () => { ... }`
- Inline callbacks as parameters or object properties: `arr.map((x) => x.id)`
- One-liners: `const double = (n: number) => n * 2`
- When you need the language-level differences: lexical `this`, no `arguments` object, etc.

## Documentation Style

- Place each sentence on its own line in markdown files (improves diffs and readability)
- List items may use single lines for brevity, but must wrap with proper indentation if line length exceeds 120 characters

## Tech Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript (ES2022, NodeNext module resolution)
- **Testing**: Vitest
- **Validation**: Zod
- **Formatting**: Prettier (no semi, single quotes, trailing commas, 100 print width)
- **Core dependency**: `@meticoeus/ddd-es` for shared DDD/ES types
