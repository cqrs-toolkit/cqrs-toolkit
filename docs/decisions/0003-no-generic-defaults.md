# ADR 0003 — No default values on new generic type parameters

**Status:** Accepted (2026-05-04)

## Context

TypeScript generic parameters can carry default types (e.g., `<TLink extends Link = Link>`).
Defaults are a public-API friendliness feature — consumers who don't care about the parameter can omit it and get the default.
They are also a hazard: defaults silently apply when threading is incomplete, masking missing work.

This was learned the hard way in the cache-key identity rework.
A `TLink` generic was introduced and `= Link` defaults were added at ~38 generic sites as a convenience.
When the defaults were later removed to enforce proper threading, it revealed that many sites had silently fallen back to the base `Link` type instead of properly threading `TLink`:

- The demo was using `Link` everywhere instead of `ServiceLink`.
- Consumer packages like `client-solid` had bare `<Link>` band-aid annotations instead of proper generic propagation.

The defaults masked incomplete work for the duration of the rework.
Catching it cost a day of cleanup that proper threading from the start would have avoided.

## Decision

When introducing a new generic parameter:

1. Define it without a default: `<TLink extends Link>`, never `<TLink extends Link = Link>`.
2. Thread it explicitly through every type, interface, class, and function that references it.
3. Fix all compilation errors by properly propagating the generic — do not widen to the base type as a shortcut.
4. If a default seems reasonable, note it in a `// TODO: default candidate = Link` comment beside the generic.
   Do not apply it during the introduction work.
5. Verify the entire app compiles with the generic properly threaded before considering whether to add a default later.

Defaults may be introduced later as a deliberate API-relaxation step, *after* threading is proven correct across the whole codebase.
That is a separate decision, made on its own merit, not a shortcut taken during the original work.

When a new field or parameter introduces a generic into a previously non-generic interface, make the interface generic and thread through all usages — do not pass the base type at the call site as a workaround.

For non-trivial cascading changes (multiple files, deep type hierarchies), the threading work is flagged and handled deliberately rather than papered over with a cast or default.

If `tsc` can auto-detect a generic parameter at the call site, that's fine.
Otherwise the parameter must be passed explicitly.

## Consequences

**Easier:**

- Missing threading is a compile error, not a silent runtime bug.
- The cost of incomplete generic propagation is paid up front (visible compilation errors), not later (silent base-type fallback).
- Refactors that change a generic's bound surface clearly through the codebase rather than slipping through default-equipped sites.

**Harder:**

- Internal call sites must always pass the generic explicitly when `tsc` can't infer it.
  This is intentional — implicit defaults were what caused the original problem.
- Adding a generic to a previously-non-generic API ripples through all usages immediately.
  This is the cost of correctness; the alternative was silent breakage.
- Public-API friendliness suffers slightly: external consumers of the library must pass the generic explicitly.
  Defaults may be added later as a deliberate concession at the public-facing edge of a specific generic, once internal threading for *that* generic is complete everywhere it is needed.
  The gate is per-generic threading correctness, not the project's release stage — the two are independent.
  `TLink` is an example where the threading work is done, so a public-edge default could be considered on its own merit; this is unrelated to the pre-release posture in [ADR 0001](0001-pre-release-no-back-compat.md).

## Related

The convention is restated in [`/docs/patterns/type-system.md`](../patterns/type-system.md) under "Do not add default values to new generic type parameters."
