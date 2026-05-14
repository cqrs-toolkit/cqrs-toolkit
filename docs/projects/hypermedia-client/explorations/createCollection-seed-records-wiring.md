# `createCollection` seed-records wiring gap

## Status

Resolved 2026-05-12 — captured in [ADR-0001](../decisions/0001-create-collection-seed-records-wiring.md) (Proposed; mutable while the design converges through consumer integration).
This file is kept for the alternatives discussion; the ADR is the canonical record.

## Context

`@cqrs-toolkit/client`'s [`SyncManager.seedOneCollection`](../../../../packages/client/src/core/sync-manager/SyncManager.ts) prefers `fetchSeedRecords` over `fetchSeedEvents` when both are defined — records go straight into the read model store, events get processed through the event pipeline.
`@cqrs-toolkit/hypermedia-client`'s [`createCollection`](../../../../packages/hypermedia-client/src/runtime/createCollection.ts) is the representation-driven Collection builder: it wires `fetchSeedEvents` from `representation.aggregateEvents` and `fetchStreamEvents` from `representation.itemEvents`, but never wires `fetchSeedRecords` from `representation.collection`.

Consequence: every consumer using `appCreateCollection = createCollection<TLink>` falls into the events-seeding path even when the server publishes a record-list endpoint.
The records URL is already in every representation surface (`representation.collection.template`, e.g. `'/api/notes{?cursor,limit}'`); the wiring is just absent.

Symmetric helper exists on the consumer side: `fetchHeaders?(cacheKey, ctx): Record<string, string>` is the per-collection cacheKey-derived contribution to request headers, merged into `FetchContext.headers` for seed event fetches.

## Starting point

Add a symmetric option that contributes the cacheKey-derived URL-template variables:

```ts
interface CreateCollectionOptions<TLink extends Link> {
  // existing
  fetchHeaders?(cacheKey: CacheKeyIdentity<TLink>, ctx: FetchContext): Record<string, string>
  // new
  fetchTemplateVariables?(
    cacheKey: CacheKeyIdentity<TLink>,
    ctx: FetchContext,
  ): Record<string, string>
}
```

When `fetchTemplateVariables` is present, `createCollection` additionally builds `fetchSeedRecords` against `representation.collection.template` — expand the template (RFC 6570) with the provided variables plus library-owned `limit` / `cursor`, GET, parse the response, return `SeedRecordPage`.
`fetchSeedEvents` remains wired as-is, serving its actual purpose (gap repair / catch-up).

Consumer call site: each tenant-/workspace-/project-scoped collection adds one `fetchTemplateVariables` callback mapping its cacheKey to template params (`{tenantId}`, `{workspaceId}`, `{projectId}`). Nothing else changes.

## Established during exploration

### Server-side envelope ownership

`@cqrs-toolkit/hypermedia`'s `formatCollection` ([`packages/hypermedia/src/server/format.ts`](../../../../packages/hypermedia/src/server/format.ts)) is the canonical place collection responses are produced. Two media types:

- `application/hal+json` — HAL collection via `HAL.fromCollection(desc, halDefs, collectionDef, opts)`. Standard HAL envelope.
- `application/json` — plain envelope `{ entities, nextCursor, totalItems, _counts }`.

Content negotiation in `wantsHAL` picks based on the request's `Accept` header.
The consumer supplies `halDefs` and `collectionDef` (the link shape and member-property contracts); the surrounding envelope is toolkit-owned on both formats.

### Package scope

`@cqrs-toolkit/hypermedia-client` is constructed for apps paired with `@cqrs-toolkit/hypermedia` server-side.
The agnostic seam is `@cqrs-toolkit/client`.
So owning both response envelopes inside `hypermedia-client` is aligned with the package's scope, not over-reach — and it inherits the same coupling `fetchEventPage` already takes for `aggregateEvents`.

### Latent forwarding gap

`createCollection` accepts no `revisionPath` option and doesn't set `Collection.revisionPath` on the returned collection.
Any consumer using `appCreateCollection = createCollection<TLink>` is silently dropping their `revisionPath` declaration today, independent of the records-path question.
The records work closes this gap as a side effect (Q2 below).

## Decisions

### Q1 — Response-body parsing → toolkit-owned parser

`createCollection` owns parsing for both envelopes (HAL and plain JSON).
The library performs the entire round trip: build the URL, send the request, parse the response, populate `SeedRecordPage`.

Rationale: `hypermedia-client`'s package scope is paired with `hypermedia-server`; both envelopes are already toolkit-owned (server side); the events path already takes the same coupling.

Alternatives:

- Consumer-supplied `parseSeedRecords` hook — rejected. Tolerates server divergence that doesn't exist within the toolkit; would only matter if `hypermedia-client` were also meant to consume non-toolkit servers, which it isn't.
- Helper only (no auto-wiring) — rejected. Doesn't close the wiring gap.

### Q1a — Media-type negotiation

Client sends `Accept: application/hal+json, application/json;q=0.9`.
The server picks via its existing `wantsHAL` content negotiation.
Parser is selected by the response `Content-Type`:

- `application/hal+json` → HAL parser (read `_embedded.item`, map members, extract `_links.next` for `nextCursor`).
- otherwise → plain JSON-envelope parser (read `entities`, `nextCursor`).

HAL is preferred for its richer embed support; either response is parsed correctly.

### Q2 — Revision / position extraction → reuse `Collection.revisionPath`

The library-owned records parser extracts `revision` from each item via the consumer's declared `revisionPath` (a `JSONPathExpression` from `@cqrs-toolkit/client`).
Two changes:

1. Add `revisionPath?: JSONPathExpression` to `CreateCollectionOptions`.
2. Forward it onto the returned `Collection.revisionPath` — closes the latent forwarding gap.
3. The records parser applies the same JSONPath to each item's parsed data and populates `SeedRecord.revision`.

`SeedRecord.position` stays `undefined`. There is no per-item position convention in the hypermedia envelopes; global position arrives via the events path.

Alternatives:

- Toolkit-standardized field name (mandate `latestRevision` on every collection member) — rejected. No good reason to take consumer flexibility away; "config is trivial" is not a good reason on its own.
- New `recordRevisionField` option — rejected. Duplicates `revisionPath`.

### Q3 — Template variables: required vs partial → fail loud at first fetch

If `representation.collection.template` declares path variables that `fetchTemplateVariables` doesn't supply, the records fetch throws at template-expansion time.
Detection at the point of use tolerates per-key conditional scoping (some cacheKeys scoped, some not) while keeping silent fallback off the table.

### Q4 — Cursor / limit handling → full template expansion

`createCollection` expands `representation.collection.template` against a combined variables map: consumer-supplied values from `fetchTemplateVariables` plus library-supplied `cursor` / `limit`. Both path placeholders (`{var}`) and form-style query expansion (`{?var,var,…}`) are honored.

**Original decision and why it was wrong.** Q4 originally read "cursor/limit as `URLSearchParams`" — `expandCollectionTemplate` stripped `{?…}` from the template, did path expansion, and then `fetchSeedRecordPage` appended `cursor`/`limit` directly to `URLSearchParams`. This was chosen for parity with [`fetchEventPage`](../../../../packages/hypermedia-client/src/runtime/fetchHelpers.ts).

The gap: when a template is query-only (every filter declared as `{?tenantId,workspaceId,projectId,…}` with no path placeholders — the swifttt convention for every list endpoint), the consumer's `fetchTemplateVariables` callback returns a map that has no path placeholders to populate. The map is therefore silently discarded. The resulting URL is `/api/.../milestones?cursor=…&limit=…` with no scope vars — exactly the over-broad-fetch problem the records-path seeding was meant to solve.

The fix: do full RFC 6570 expansion. `fetchTemplateVariables` returns the values the template's declared variables expect; `cursor`/`limit` join the map as library-supplied values and flow through the same expansion. The template authoritatively declares which params the endpoint accepts, and the library honors that contract.

Alternatives that were considered when the gap surfaced:

- Separate `fetchQueryParams` callback (symmetric with `fetchHeaders`) — clean semantic split, but adds a callback for a concern that's already covered by `fetchTemplateVariables`' role as "values for the template's declared variables." The existing JSDoc already implies this scope; the fix is to honor it, not to split it.
- One map, library splits (consume map for both path and query, silently route by declaration) — equivalent ergonomics to the full-expansion approach, but mixes concerns and silently drops entries the template doesn't declare. Full expansion is the more honest model.

### Q5 — `fetchHeaders` + `fetchTemplateVariables` coexistence → keep two callbacks

The starting-point shape stands.
A unified `fetchScope?(cacheKey, ctx): { headers?; variables? }` was considered but rejected to avoid breaking the existing `fetchHeaders` API for already-wired collections.

### Q6 — Scope creep: scoped event endpoints → defer

`fetchSeedEvents` collapses `representation.aggregateEvents.template` to its base `href`, ignoring path-variable expansion.
If consumers later need scoped aggregate-event endpoints (e.g. `/api/tenants/{tenantId}/events/notes`), the same `fetchTemplateVariables` callback could be threaded into the events path.
No driver today; defer until a real consumer needs it.
`fetchStreamEvents` is unaffected — its variables come from `streamId`, not the cacheKey.

## Resulting shape

```ts
interface CreateCollectionOptions<TLink extends Link> {
  // ... existing options unchanged ...

  /** Existing: per-collection cacheKey-derived headers, merged into FetchContext.headers. */
  fetchHeaders?(cacheKey: CacheKeyIdentity<TLink>, ctx: FetchContext): Record<string, string>

  /**
   * New: per-collection cacheKey-derived URL-template variables for
   * representation.collection.template path expansion. Presence activates
   * library-wired fetchSeedRecords.
   */
  fetchTemplateVariables?(
    cacheKey: CacheKeyIdentity<TLink>,
    ctx: FetchContext,
  ): Record<string, string>

  /**
   * New: forwarded onto Collection.revisionPath. Used by the records parser
   * to extract `SeedRecord.revision` from each item, and downstream by
   * AggregateChain for lastKnownRevision advancement.
   */
  revisionPath?: JSONPathExpression
}
```

`createCollection` behavioural changes:

- Always sets `Collection.revisionPath` from `opts.revisionPath` (closes the latent forwarding gap; standalone benefit).
- When `fetchTemplateVariables` is present, additionally wires `Collection.fetchSeedRecords`:
  - Expand `representation.collection.template` path variables from `fetchTemplateVariables(cacheKey, ctx)` (RFC 6570).
  - Append `cursor`, `limit` as `URLSearchParams`.
  - Send `Accept: application/hal+json, application/json;q=0.9`.
  - Apply `fetchHeaders` if present (same merge semantics as `fetchSeedEvents`).
  - Select parser by response `Content-Type` (HAL or JSON envelope).
  - Extract per-item `revision` via `revisionPath` when declared; otherwise leave `SeedRecord.revision` undefined.
  - Return `SeedRecordPage`.
- `fetchSeedEvents` wiring unchanged — gap repair / catch-up path retained.

## Cost of doing nothing

- Consumers either write a parallel `fetchSeedRecords` themselves (bypassing `createCollection` for the records path, as `demos/todo-demo` does) or accept events-only seeding for every scoped collection. The library's "build the Collection from the representation" affordance silently degrades the further the consumer is from the demo's flat URL structure.
- Over-tagging WS subscriptions / over-fetching event pages becomes the consumer's concern to scope correctly, because the events-only seeding path doesn't carry tenant/workspace scope at all.
- `revisionPath` keeps being silently dropped for any consumer using `appCreateCollection`, regardless of the records-path question.

## Next

Codified in [ADR-0001](../decisions/0001-create-collection-seed-records-wiring.md). This exploration stays in place for the alternatives discussion.
