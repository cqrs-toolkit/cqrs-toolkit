# HAL `_links` stripping — should it be configurable?

## Status

Open. No active driver yet; deferred until a consumer needs `_links` in their read model.

## Context

[ADR-0001](../decisions/0001-create-collection-seed-records-wiring.md)'s HAL parser drops `_links` from every member (top-level and recursively inside `_embedded`) before writing `SeedRecord.data`.
The rationale: in the current architecture, link-following / navigation concerns live in the toolkit (command sender, representation generation, etc.) — the consumer's read model holds domain data, not transport metadata.

`_embedded` is preserved (per the same ADR) so that nested resources reach the read model intact and the consumer's schema codegen can model them.
Recursive `_links` stripping keeps the cleaned shape consistent at every level of `_embedded` nesting.

## The open question

Is the recursive `_links` strip the right _default_, the right _only_ behaviour, or should it be configurable?

Possible drivers for keeping `_links`:

- A consumer that renders absolute URLs in the UI (e.g. a "share this resource" link copied from the canonical `self`) and wants the href to live in the read model rather than re-deriving it.
- A consumer that wants to display profile URIs (`_links.curies`, `_links.profile`) for human-facing version diagnostics.
- An app whose read model serves as a HAL passthrough to another layer.

None of these exist in the cqrs-toolkit demos or known consumers today.

## Candidate shapes (when a driver appears)

- **Per-collection option on `CreateCollectionOptions`** — e.g. `preserveLinks?: 'none' | 'self' | 'all'`. Symmetric with other per-collection settings. Default `'none'` keeps today's behaviour.
- **Per-collection JSONPath filter** — explicit list of link relations to preserve (`preserveLinks: ['self', 'profile']`). More expressive; rare-case overkill.
- **Global parser config** — set once, applies everywhere. Simpler but doesn't accommodate per-collection variation.
- **Always preserve `_links`, let the consumer drop them downstream** — passes the buck to the consumer's read-model layer. Inverts the default but keeps the runtime simple.

The first option is the natural starting point; the others are reachable from it without a breaking change.

## Why not decide now

No driver, and adding the option preemptively bakes in an API guess that may not match the real shape consumers want.
The current behaviour (strip recursively) is the conservative default — adding configurability later is additive; defaulting to "preserve" and asking consumers to strip would be a breaking change.

When a real use case surfaces, this exploration gets promoted into a follow-up ADR.

## Related

- [ADR-0001](../decisions/0001-create-collection-seed-records-wiring.md) — current behaviour is set here in the records-fetch-behaviour section.
- The recursive cleaner lives at [`packages/hypermedia-client/src/runtime/fetchHelpers.ts`](../../../../packages/hypermedia-client/src/runtime/fetchHelpers.ts) (`cleanHalResource`).
