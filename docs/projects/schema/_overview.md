# @cqrs-toolkit/schema

**Status:** Active
**Castle:** this directory
**Public API:** experimental
**Depends on (within repo):** none
**Depended on by (within repo):** `hypermedia`; demos: `hypermedia-server`

## Purpose

JSON Schema validation, `$id`/`$ref` linking, and runtime value hydration for event-sourced systems.
Wraps AJV with automatic sub-schema discovery, composable `$ref` replacement, and a visitor-based hydration layer that converts validated string values into domain types (e.g. int64 strings to `BigInt`).

## Current state

Two entry points: core API (validation, registry, visitors) and test helpers (`bootstrapTestAjv`, `prettyErrorResult`).
Built-in `int64Visitor`; custom visitors registrable via `validatorProvider.setAjv(ajv, [...visitors])`.
Validation errors return as `Result<T, SchemaException>` per the project's error-handling pattern.

## Where things live

- Code: `packages/schema/`
- Unit tests: `packages/schema/src/**/*.test.ts` (beside source)
- Generated API docs: `packages/schema/docs/api/`
- Public consumer-facing intro: `packages/schema/README.md`
- Package operational guidance: `packages/schema/CLAUDE.md`
