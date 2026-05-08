# ADR 0004 — Prefer `undefined` over `null` for absence

**Status:** Accepted (2026-05-04)

## Context

JavaScript distinguishes two "absence" values: `undefined` and `null`.
TypeScript treats them as distinct types.
A codebase that uses both interchangeably ends up with three flavours of "missing": `undefined`, `null`, and "either."
Every consumer must defend against all three.

External boundaries impose `null` whether we like it or not — SQL `NULL` columns, HTTP API contracts that distinguish "field absent" from "field set to null," `JSON.stringify`'s third argument, etc.
Internal code can pick one and stick with it.

## Decision

Use `undefined` for absence throughout internal code — optional properties, missing results, unset state.

`null` is permitted only at the boundaries that genuinely require it:

- **SQL persistence.**
  `IStorage` record types use `null` for nullable columns.
  The storage layer (`IStorage`, `SQLiteStorage`, `InMemoryStorage`) and types that mirror SQL rows keep `null`.
- **HTTP API contracts.**
  Pagination cursors (`nextCursor: string | null`) and other API response shapes that distinguish `null` from absent.
  Local variables that directly shuttle values to/from these APIs (e.g., a `cursor` loop variable) stay `string | null`.
- **JavaScript built-ins.**
  `JSON.stringify(x, null, 2)`, `JSON.parse` null checks, etc.

At each boundary, convert `null` to `undefined` so the rest of the codebase deals only with `undefined`.
Consumer-facing types that wrap a nullable storage field (e.g., `ReadModel.serverData`) use `undefined`, with the conversion happening in the read path (e.g., `recordToReadModel`).

## Consequences

**Easier:**

- Internal consumers handle exactly one absence type.
- `if (value)` truthiness checks suffice for narrowing absent-vs-present in most internal code, since `undefined` is the only falsy "missing" value to worry about.
- Type signatures are cleaner: `string | undefined` vs the alternative `string | null | undefined`.

**Harder:**

- Boundary code must remember to convert.
  This is concentrated in a few well-defined places (storage record-to-domain mapping, API response parsing) so it's manageable.
- Consumers reading SQL records directly see `null`; consumers reading domain types see `undefined`.
  The boundary is real, but it's a single place per direction.

## Related

Restated in [`/docs/patterns/type-system.md`](../patterns/type-system.md) under "Prefer `undefined` over `null`."
