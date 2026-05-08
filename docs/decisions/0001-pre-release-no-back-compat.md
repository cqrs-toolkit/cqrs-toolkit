# ADR 0001 — Pre-release: no back-compat shims, breaking changes acceptable

**Status:** Accepted (2026-05-04)

## Context

The cqrs-toolkit monorepo is in active pre-release development.
Initial release (semver 0.x) has not yet shipped.
The public API surface — exports, type signatures, package boundaries — is not finalized.

Software projects accumulate friction when they add backwards-compatibility shims early: deprecation cycles, migration paths, dual code paths, type-aliases that prevent renaming.
Those costs are paid willingly when there is an existing user base.
There is no existing user base for cqrs-toolkit.

## Decision

While the project is pre-release:

- Breaking changes are acceptable and expected.
  No back-compat shims, no deprecation cycles, no `_renamed` re-exports, no transitional types.
- Exports, type signatures, package boundaries, naming, and module structure may change freely.
- The client-side SQLite schema is not finalized.
  The initial migration may change before stable release; until then, upgrading the library may require clearing OPFS data in the browser.
- The published `package.json` files use `0.x` versions and the README warns "Do not use in production."

This is the project's deliberate posture during pre-release, not an oversight.

## Consequences

**Easier:**

- Naming corrections without renames.
  Refactors that touch the public surface land directly.
  No accumulating dead code from old names kept "for compatibility."
- Type signatures move freely as understanding improves.
- Code review evaluates each change on its current merit, not against the cost of a migration path.

**Harder:**

- Anyone adopting the library before stable release must accept that any update may break them.
  The README states this explicitly.
- Cannot point at the package as a stable dependency in external projects without pinning a specific version.

## Supersession

This ADR is superseded when the project leaves pre-release.
The superseding ADR will document:

- The release that marks the boundary (typically `1.0.0`).
- The new posture on breaking changes (semver discipline; deprecation cycles required).
- Any lingering shims or deprecation paths that exist at the boundary, with their planned removal dates.

When that happens, this ADR gets a `Superseded by ADR-NNNN (YYYY-MM-DD)` line above the Status field; nothing else here changes.
