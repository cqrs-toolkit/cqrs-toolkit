# Error handling

This project follows the error-handling model used by Rust, Go, and Erlang — not JavaScript's convention of throwing exceptions for everything.
Throwing conflates bugs with expected failures, making it impossible for callers to know which errors to handle and which indicate broken code.

Three error categories, each with a distinct mechanism:

## 1. Expected domain failures — `Result<T, E extends IException>`

Business rule violations, validation errors, permission denials.
Return a typed `Result` using `Ok(value)` / `Err(error)` from `@meticoeus/ddd-es`; never thrown.

Do not create ad-hoc discriminated unions for success/failure — use the library's `Result<T, E>` type.
Custom error types must extend the `Exception` base class from `@meticoeus/ddd-es`.

`E` must extend `IException`.
This is a project rule, enforced by convention rather than by the library type.
The library's current signature is the looser `Result<T, E = IException>` — a default, not a constraint — so non-`IException` values in the `E` slot would compile, but they are not allowed here.
The library may eventually be tightened to `E extends IException`; the project rule does not depend on that landing, and if the tightening proves infeasible the rule still stands.

For the exact type definitions of `Result`, `Ok`, `Err`, `Exception`, and `IException`, see [`/docs/intent/glossary.md`](../intent/glossary.md).

## 2. Code bugs / invariant violations — `assert` from `node:assert`

Conditions that must hold if the code is correct: exhaustive switches, impossible states, missing config.
An `AssertionError` means a developer needs to fix something.

## 3. External / library failures — thrown `Error`

Database connection lost, S3 timeout, third-party SDK exception.
Infrastructure code catches these at the boundary and either translates them to domain results (category 1) or lets them propagate as unrecoverable.

## Rule of thumb

- If the failure means *we have a bug*, use `assert`.
- If it means *the outside world did something unexpected*, throw or propagate an `Error`.
- If it means *the user/caller asked for something the business rules don't allow*, return a typed `Result`.

## Boundary discipline

Domain code does not catch thrown errors arbitrarily.
External calls that can throw are caught at the layer that owns the contract — typically the same layer that knows what kind of domain failure that external error maps to (e.g., a network layer that translates a connection error into a `ConnectivityException` for the domain, or simply re-throws the underlying error if it should propagate as unrecoverable).

`Promise.catch(() => {})` (empty catch) is forbidden — it is error hiding, not error handling.
If an error is genuinely ignorable, add a comment explaining why.
If it needs handling, handle it.
If it should propagate, don't catch it.

## Where applied

Repo-wide.
All packages use `Result<T, E>` for domain failures and the three-category split for the rest.
The shared library carrying the primitives (`@meticoeus/ddd-es`) is required as a peer dependency in any package that participates in the pattern.

## Rationale

See ADR [`/docs/decisions/0002-error-handling-three-categories.md`](../decisions/0002-error-handling-three-categories.md).

## Referenced from

- [`/docs/decisions/0002-error-handling-three-categories.md`](../decisions/0002-error-handling-three-categories.md) — the ADR that justifies this pattern (cross-link).
- [`/docs/intent/glossary.md`](../intent/glossary.md) — points here for the rules on when to use `Result` vs `assert` vs throw, alongside the `@meticoeus/ddd-es` type definitions.
- [`/docs/patterns/structural-honesty.md`](structural-honesty.md) — points here for the empty-`.catch()` rule, which is the same rule restated in both files.
