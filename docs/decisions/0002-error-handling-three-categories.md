# ADR 0002 — Error handling: three distinct categories, three distinct mechanisms

**Status:** Accepted (2026-05-04)

## Context

JavaScript and TypeScript codebases conventionally handle errors by throwing `Error` instances and catching them with `try`/`catch`.
This convention conflates three categorically different conditions:

1. The user / caller asked for something the business rules don't allow (an *expected* failure mode the caller knows how to handle).
2. The code itself is broken — an invariant was violated, an "impossible" branch was reached.
3. An external system did something unexpected (network timeout, library bug, infrastructure failure).

When all three travel through the same channel, callers cannot tell which is which.
The same `catch` block ends up handling "user input was wrong" and "we have a bug here" with the same code path.
Bugs get swallowed; expected failures get logged like crashes; the actual handling logic becomes a probabilistic guess.

The project relies on `@meticoeus/ddd-es` for shared DDD/event-sourcing primitives, which provides a Rust-style `Result<T, E>` type along with `Ok`, `Err`, `Exception`, and `IException`.

## Decision

Use three distinct mechanisms, one per category:

1. **Expected domain failures** — return a typed `Result<T, E>` from `@meticoeus/ddd-es`, where `E` extends `IException`.
   Never thrown.
   Custom error types extend `Exception`.

   The library's current signature is `Result<T, E = IException>` — a default, not a constraint — so non-`IException` values in the `E` slot would compile.
   The project rule is to treat the slot as if `E extends IException` were enforced, regardless of the library's laxness, and to never put a non-`IException` value there.
   The library may eventually be tightened to enforce the constraint; the project rule does not depend on that landing.
   If the tightening proves infeasible, the project rule still stands.
2. **Code bugs / invariant violations** — `assert` from `node:assert`.
   Throwing an `AssertionError` is the explicit "developer needs to fix something" signal.
3. **External / library failures** — thrown `Error` (caught at the boundary that owns the contract, where it gets translated to a domain `Result` or propagates as unrecoverable).

The rule of thumb is captured in [`/docs/patterns/error-handling.md`](../patterns/error-handling.md):

- "We have a bug" → `assert`.
- "The outside world did something unexpected" → throw or propagate `Error`.
- "The caller asked for something not allowed" → return `Result`.

## Consequences

**Easier:**

- Function signatures are honest about what can fail.
  A `Result<T, E>` return type tells callers: "this call has a known failure mode you must handle."
- Bugs become loud (assertion failures crash with stack traces) instead of silent (caught generically alongside everything else).
- Code review can flag mismatches: domain failures escaping as throws, or bugs being downgraded to `Result.Err`.

**Harder:**

- TypeScript callers must explicitly check the `Result` arm — no implicit "happy path."
  This is the point: the cost is in writing, not in maintenance.
- Three mechanisms are more conceptual surface than one.
  The taxonomy must be taught (this ADR + the pattern doc) and applied consistently.
- Boundaries with external libraries that throw must be explicit about translating into the right category.

## Notes

Ad-hoc discriminated unions for success / failure (e.g., `{ ok: true, ... } | { ok: false, ... }` defined per call site) are not allowed; use the library's `Result<T, E>` type so the shape is uniform across the codebase.

`Promise.catch(() => {})` (empty catch) is forbidden — it is error hiding, not error handling.
