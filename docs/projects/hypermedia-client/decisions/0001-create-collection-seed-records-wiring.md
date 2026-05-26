# ADR 0001 (hypermedia-client) — `createCollection` library-wires `fetchSeedRecords` against the representation

**Status:** Proposed (created 2026-05-12)

## Context

[`@cqrs-toolkit/client`'s `SyncManager.seedOneCollection`](../../../../packages/client/src/core/sync-manager/SyncManager.ts) prefers `Collection.fetchSeedRecords` over `Collection.fetchSeedEvents` when both are defined — records go straight into the read model store (single bulk write), events get processed through the full event pipeline.

[`@cqrs-toolkit/hypermedia-client`'s `createCollection`](../../../../packages/hypermedia-client/src/runtime/createCollection.ts) is the representation-driven `Collection` builder: it wires `fetchSeedEvents` from `representation.aggregateEvents` and `fetchStreamEvents` from `representation.itemEvents`, but does not wire `fetchSeedRecords` from `representation.collection`.
Every consumer using `appCreateCollection = createCollection<TLink>` therefore falls into the events-seeding path even when the server publishes a record-list endpoint.
The records URL is already present in every representation surface (`representation.collection.template`); the wiring is just absent.

A secondary, latent gap: `createCollection` does not accept or forward `revisionPath`, so any consumer using `appCreateCollection` silently drops their `Collection.revisionPath` declaration today.
This affects both seed paths and `AggregateChain.lastKnownRevision` advancement from server data — closing it falls out of the records work.

[`@cqrs-toolkit/hypermedia`'s `formatCollection`](../../../../packages/hypermedia/src/server/format.ts) emits two envelopes via content negotiation:

- `application/hal+json` — HAL collection (`_links`, `_embedded.item`, `totalItems`) via `HAL.fromCollection`.
- `application/json` — plain envelope `{ entities, nextCursor, totalItems, _counts }`.

The consumer app supplies the per-resource `HAL.ResourceDefinition[]` and per-collection `HAL.CollectionDefinition` (link shape and member-property contracts); the surrounding envelope is toolkit-owned on both formats.

The full exploration of alternatives is in [`../explorations/createCollection-seed-records-wiring.md`](../explorations/createCollection-seed-records-wiring.md).

## Decision

`createCollection` accepts two new options and library-wires `fetchSeedRecords` when the records-path option is present.

### New `CreateCollectionOptions` fields

```ts
interface CreateCollectionOptions<TLink extends Link> {
  // ... existing options unchanged ...

  /**
   * Forwarded onto Collection.revisionPath. Used by the records parser to
   * extract `SeedRecord.revision` from each item, and downstream by
   * AggregateChain.lastKnownRevision advancement.
   */
  revisionPath?: JSONPathExpression

  /**
   * Per-collection cacheKey-derived URL-template variables for
   * representation.collection.template path expansion. Presence activates
   * library-wired fetchSeedRecords.
   */
  fetchTemplateVariables?(
    cacheKey: CacheKeyIdentity<TLink>,
    ctx: FetchContext,
  ): Record<string, string>
}
```

### Behavioural changes in `createCollection`

1. **`revisionPath` is always forwarded** to the returned `Collection.revisionPath`, independent of records wiring. Closes the latent forwarding gap; no behaviour change for consumers that did not previously declare it.
2. **`fetchSeedRecords` is wired when `fetchTemplateVariables` is present.** Without `fetchTemplateVariables`, `fetchSeedRecords` remains unset and `SyncManager` falls back to `fetchSeedEvents`.
3. **`fetchSeedEvents` wiring is unchanged.** Gap repair / catch-up continues to use the events path.

### Records fetch behaviour

When `fetchSeedRecords` is invoked by `SyncManager`:

1. **Full template expansion.** `representation.collection.template` is expanded against a combined variables map: consumer-supplied values from `fetchTemplateVariables(cacheKey, ctx)` plus the library-supplied `cursor` and `limit`. Library values win on collision. The expansion honors both path placeholders (`{var}`) and form-style query expansion (`{?var,var,…}`); the template authoritatively declares which parameters the endpoint accepts.
2. **Missing-variable semantics follow the template.** Path placeholders (`{var}`) are required — if the map doesn't provide a value, expansion throws. Query parameters declared in `{?…}` are optional — undefined values are omitted, matching RFC 6570 form-style behaviour. `cursor` is omitted on the first page (when `null`); `limit` is always supplied.
3. **Headers.** `Accept: application/hal+json, application/json;q=0.9` plus any `fetchHeaders(cacheKey, ctx)` contributions, merged into `ctx.headers` with the same semantics as the events path.
4. **Response parsing.** Driven by the response `Content-Type`:
   - `application/hal+json` → HAL parser: `body._embedded.item` are the members; each member is recursively cleaned to produce `data` — `_links` is dropped at every level, `_embedded` is preserved as a nested key with each rel's resource(s) recursively cleaned by the same rules. Domain properties pass through verbatim (no recursion outside `_embedded`). `nextCursor` is extracted from `body._links.next.href` as the `cursor` query parameter. Whether the recursive `_links` strip should be configurable is tracked in [`../explorations/hal-link-stripping.md`](../explorations/hal-link-stripping.md).
   - otherwise → JSON-envelope parser: `body.entities` are the members directly; `body.nextCursor` is the cursor.
5. **Revision extraction.** For each member, if `revisionPath` is set, the JSONPath is evaluated against the member's `data` and the resulting string populates `SeedRecord.revision`. When `revisionPath` is absent or the path resolves to a non-string, `revision` is left `undefined`. `SeedRecord.position` is always `undefined` — there is no per-item position field in either envelope.

### Scope

- `fetchStreamEvents` wiring is unchanged; stream variables come from `streamId`, not `cacheKey`.
- `fetchSeedEvents` does **not** consult `fetchTemplateVariables` today. The aggregate-events template is collapsed to its base href as before. If a real driver appears for scoped aggregate-event endpoints, the same `fetchTemplateVariables` callback is the natural lever to thread through; that is future work, not part of this ADR.

## Consequences

### Implementation impact

- New options on `CreateCollectionOptions` (`revisionPath`, `fetchTemplateVariables`).
- Always-forward `revisionPath` to the returned `Collection`.
- New records-path fetch helper in `runtime/fetchHelpers.ts`: template expansion, request, content-type-based parser selection, revision extraction.
- HAL collection envelope parser and plain JSON envelope parser, both producing `SeedRecordPage` from a parsed response body.
- Minimal in-package implementations of:
  - RFC 6570 URI template expansion: Simple path expansion (`{var}`) plus form-style query expansion (`{?var,var,…}`). Other RFC 6570 operators (`{+var}`, `{#var}`, `{var*}` explode, etc.) are out of scope until a driver appears.
  - JSONPath read for `revisionPath` (dot- and bracket-string segments, no wildcards), scoped to what `Collection.revisionPath` realistically needs.

The minimal in-package JSONPath read avoids widening `@cqrs-toolkit/client`'s public API surface for a single consumer's needs. If a later case forces full JSONPath capabilities here, promoting `getAtPath` to client's public API is a small follow-up; until then, the duplication is bounded to the path shapes the `revisionPath` docstring already documents.

### Operational implications

#### Gains

- Consumers using `appCreateCollection` get the records-seeding path automatically when their representation has a collection surface — no per-collection `fetchSeedRecords` boilerplate.
- Tenant/workspace/project-scoped collections express their scope once, as a `fetchTemplateVariables` callback, instead of duplicating URL construction per call site.
- Bulk-write records seeding (no event pipeline overhead) becomes the default for hypermedia consumers, matching what hand-rolled consumers already do.
- The latent `revisionPath` forwarding gap closes, restoring `AggregateChain.lastKnownRevision` advancement for any `appCreateCollection` consumer that declares the path.

### Coding implications

#### Gains

- One canonical place (the toolkit) parses HAL and JSON collection envelopes; consumers stop hand-writing per-server parsers like `demos/todo-demo/src/domain/utils/collection.ts`'s `fetchSeedRecordPage`. (The todo-demo's own server is not hypermedia and stays out of scope.)
- `createCollection` becomes the single layer at which "build a Collection from a representation" decisions live; previously `fetchSeedRecords` was the one option that didn't get this treatment.

#### Costs

- `hypermedia-client` now contains both the request-issuing and response-parsing logic for collection records — coupling the package more tightly to `hypermedia-server`'s envelope. This is aligned with the package's purpose (it exists specifically for apps paired with `hypermedia-server`); the agnostic seam stays in `@cqrs-toolkit/client`.

## Alternatives considered

**Consumer-supplied `parseSeedRecords?(body): SeedRecordPage` hook.**
Considered as a way to tolerate server divergence from the hypermedia envelope. Rejected: `hypermedia-client` is by construction paired with `hypermedia-server`, so the envelopes are toolkit-owned end-to-end — there is no realistic divergence to tolerate, and adding a hook would carry no benefit while expanding the API surface.

**Helper-only (`expandCollectionTemplate(representation, vars, ctx)` exported; consumer writes `fetchSeedRecords`).**
Considered as the minimal API addition. Rejected: doesn't close the wiring gap. The point of the change is for `appCreateCollection` users to stop writing per-collection `fetchSeedRecords` boilerplate; an exported helper just relocates the boilerplate.

**Toolkit-mandated per-item revision field (e.g., `latestRevision` required on every collection member).**
Considered as a way to eliminate the `revisionPath` configuration step. Rejected: takes consumer flexibility away for a trivial config saving. Existing `Collection.revisionPath` already covers per-app field-name variation (`$.revision` vs `$.latestRevision` examples in its docstring), and forwarding it through `createCollection` reuses that mechanism cleanly.

**New `recordRevisionField?: string` option on `createCollection`.**
Considered as a simpler config than a JSONPath. Rejected: duplicates `Collection.revisionPath` (which exists and is already documented), and a string-field-name option is strictly less expressive than the JSONPath one. Reusing `revisionPath` also closes the latent forwarding bug as a side effect.

**Unified `fetchScope?(cacheKey, ctx): { headers?; variables? }` replacing `fetchHeaders`.**
Considered as a single-callback alternative to the symmetric two-callback shape. Rejected: breaks the existing `fetchHeaders` API for already-wired collections. The two-callback shape costs nothing structural.

**Promote `getAtPath` from `@cqrs-toolkit/client` to the public API for revision-path evaluation.**
Considered to avoid duplicating JSONPath logic. Rejected for now in favour of an in-package minimal extractor scoped to what `Collection.revisionPath` realistically requires (dot- and bracket-string segments, no wildcards). Widening client's public API for a single consumer's needs is a design decision that warrants its own driver; the duplication is bounded and trivially reversible if a future driver appears.

## Related

- [ADR-0002](0002-create-collection-contributor-shape.md) — reshapes `createCollection` into a contributor (drops every pass-through option, returns only `revisionPath` + the three representation-derived fetchers). The two records-wiring fields introduced here (`revisionPath`, `fetchTemplateVariables`) survive intact; only the surrounding helper API reshapes.
- Sourced from exploration: [`../explorations/createCollection-seed-records-wiring.md`](../explorations/createCollection-seed-records-wiring.md). The exploration persists past this ADR's acceptance, kept for the Q1–Q6 alternatives discussion — including the corrected Q4 that recorded the URLSearchParams approach as evolved-and-rejected. The only genuinely deferred item is Q6 (scoped aggregate-event endpoints), tracked there until a real driver surfaces.
- Touches `Collection.revisionPath` from [`@cqrs-toolkit/client`'s config](../../../../packages/client/src/types/config.ts) — no semantic change, only forwarding.
- Depends on the server-side envelope shapes produced by [`@cqrs-toolkit/hypermedia`'s `formatCollection`](../../../../packages/hypermedia/src/server/format.ts) (HAL via `HAL.fromCollection`, JSON via the `{ entities, nextCursor, totalItems, _counts }` fallback).
