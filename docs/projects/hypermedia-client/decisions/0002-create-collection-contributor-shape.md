# ADR 0002 (hypermedia-client) — `createCollection` is a contributor, not a whole-Collection factory

**Status:** Proposed (created 2026-05-21)

## Context

[`@cqrs-toolkit/hypermedia-client`'s `createCollection`](../../../../packages/hypermedia-client/src/runtime/createCollection.ts) — and its typed alias `appCreateCollection = createCollection<TLink>` — has been a whole-`Collection` factory.
It accepted every `Collection<TLink>` field as either a consumed input (`representation`, `revisionPath`, `fetchTemplateVariables`, `fetchHeaders`, `aggregateId`) or a pass-through input (`name`, `aggregate`, `idReferences`, `cacheKeysFromTopics`, `matchesStream`, `seedOnInit`, `seedOnDemand`), and returned a full `Collection<TLink>`.

This shape ties the helper's input/output to `Collection<TLink>`'s evolution.
Every time `Collection<TLink>` grows a new field — most recently `list` (read-model views and custom SQL columns; see [`client/explorations/cross-collection-joins.md`](../../client/explorations/cross-collection-joins.md)) — consumers using `appCreateCollection` faced one of two unforced workarounds:

1. Add a new pass-through option on `CreateCollectionOptions`, restating a field that the helper has no opinion about. The helper accumulates fields whose only contract is "forward this exact value."
2. Spread the helper's return into a wider literal: `{ ...appCreateCollection({...}), list: {...} } as const`. The literal then carries the new field but also collides with `Collection<TLink>`'s nominal type unless the consumer also re-types the result.

Both workarounds are mechanical churn forced by a structural mismatch: the helper has an opinion about three things (the representation-derived fetchers and the revision path) and zero opinion about everything else.

## Decision

`createCollection` becomes a **contributor**: it takes only the inputs it actually consumes, and returns only the fields it actually owns. Consumers spread the result into a `Collection<TLink>` literal they write themselves.

### Input — only what the helper consumes

```ts
export interface CreateCollectionOptions<TLink extends Link> {
  representation: RepresentationSurfaces
  readonly revisionPath?: JSONPathExpression
  aggregateId?: (streamId: string) => string
  fetchHeaders?(cacheKey: CacheKeyIdentity<TLink>, ctx: FetchContext): Record<string, string>
  fetchTemplateVariables?(
    cacheKey: CacheKeyIdentity<TLink>,
    ctx: FetchContext,
  ): Record<string, string>
}
```

Removed (no longer accepted): `name`, `aggregate`, `idReferences`, `cacheKeysFromTopics`, `matchesStream`, `seedOnInit`, `seedOnDemand`. These move to the consumer literal.

### Output — only what the helper produces

```ts
export type CreateCollectionResult<TLink extends Link> = Pick<
  Collection<TLink>,
  'revisionPath' | 'fetchSeedEvents' | 'fetchStreamEvents' | 'fetchSeedRecords'
>
```

`revisionPath` flows from input to output — the consumer declares it once on the helper's input, the helper forwards it onto the contribution, and `fetchSeedRecords` uses the same value internally for `SeedRecord.revision` extraction. This is the only "consumed by the helper _and_ visible to the consumer-owned literal" field, and the forwarding makes it a single-declaration concern.

### Consumer usage

```ts
export const todosCollection = {
  name: TODOS_COLLECTION_NAME,
  aggregate: TodoAggregate,
  cacheKeysFromTopics: () => [TODO_SEED_KEY],
  matchesStream: (s: string) => s.startsWith('nb.Todo-'),
  seedOnInit: { cacheKey: deriveScopeKey({ scopeType: 'todos' }), topics: ['Todo:*'] },
  list: { defaultSort: [{ column: 'updated_at', direction: 'desc' }] },
  ...appCreateCollection({
    representation: representations['nb:Todo'],
  }),
} satisfies Collection<ServiceLink>
```

`satisfies Collection<ServiceLink>` is the assignability check: it verifies the literal is a valid `Collection` (catches typos in field names, missing required fields) while keeping the inferred type narrow. `as const` does not check assignability and is the wrong tool here.

## Consequences

### Implementation impact

- `CreateCollectionOptions` shrinks to the five consumed fields.
- `CreateCollectionResult<TLink>` is a new exported type — a `Pick` of `Collection<TLink>` — naming the contributor's surface.
- `createCollection` returns `CreateCollectionResult<TLink>` instead of `Collection<TLink>`.
- The two records-wiring fields from [ADR-0001](0001-create-collection-seed-records-wiring.md) (`revisionPath`, `fetchTemplateVariables`) are unchanged in behaviour — `revisionPath` still forwards unconditionally, `fetchSeedRecords` still wires conditionally on `fetchTemplateVariables`. Only the surrounding helper shape changes.
- All four `hypermedia-base` demo collections (`todos`, `notebooks`, `notes`, `file-objects`) migrate to the consumer-literal form in the same change.

### Operational implications

#### Gains

- New `Collection<TLink>` fields land on consumer literals without forcing pass-through options on `createCollection`. The helper's API surface no longer accumulates fields it has no opinion about.
- The "spread into a wider literal" pattern that consumers were already using ad-hoc for `list` becomes the canonical shape, with one helper call per collection rather than mixed factory/spread idioms.
- The consumer sees every `Collection` field it sets — the helper hides only the fields it derives from the representation. Easier to reason about which fields come from where.

#### Costs

- Consumer literals are longer: the seven previously-forwarded fields are now declared on the literal directly. For a typical collection this is six to eight extra lines.
- The shared aliased typed `appCreateCollection = createCollection<TLink>` no longer "writes a Collection" — it writes a slice. The mental-model shift from "factory" to "contributor" is the main cost; the test-suite migration in the same change exemplifies the new shape.

### Coding implications

#### Gains

- One canonical assembly site (the consumer literal) for everything that varies per collection. Previously the helper was both an assembly site for some fields and a forwarder for others; that ambiguity is gone.
- `satisfies Collection<TLink>` on the consumer literal gives full structural type-checking, including unknown-field detection — `createCollection` previously accepted typo'd `name` and `matchesStream` values silently as pass-throughs (no opinion = no check).

#### Costs

- None beyond the operational length increase.

## Alternatives considered

**Keep `createCollection` as a whole-Collection factory, expand pass-through options whenever `Collection` grows.**
The status-quo option. Rejected: every new `Collection` field is a forced edit here, and the helper accumulates opinion-free fields. Already producing the bookkeeping cost that motivated this ADR (`list` was the third such forced edit).

**Return a `Partial<Collection<TLink>>` instead of a named `Pick`.**
Considered as the minimal type change. Rejected: `Partial` widens every field to optional regardless of whether the helper sets it, making `wiring.fetchSeedEvents!(...)` necessary in tests. The `Pick` mirrors `Collection`'s own optionality (every Picked field is already optional on `Collection<TLink>`) — same assertion-free ergonomics, narrower meaning.

**Expose three separate helpers (`createSeedEventsFetcher`, `createStreamEventsFetcher`, `createSeedRecordsFetcher`) instead of one contributor.**
Considered for maximum decomposition. Rejected: the three fetchers share `representation`, `fetchHeaders`, `aggregateId`, and (for two of them) `revisionPath`. Splitting the helper forces consumers to repeat shared inputs three times, and to coordinate `revisionPath` across two of the three. A single contributor with one input map preserves the cohesion that exists in practice.

**Keep `name` on the helper as a convenience pass-through (only that one).**
Considered because `name` always pairs with the representation in practice. Rejected: pairs-in-practice is not opinion. The helper has no opinion about which name to assign; the consumer does. Carving out `name` would re-create the slippery-slope that motivated the ADR.

## Related

- [ADR-0001](0001-create-collection-seed-records-wiring.md) — adds the records-wiring options (`revisionPath`, `fetchTemplateVariables`) that survive into this ADR's contributor shape. Records-wiring behaviour is unchanged; only the surrounding helper API reshapes.
- [`client/explorations/cross-collection-joins.md`](../../client/explorations/cross-collection-joins.md) — introduced `Collection.list` for read-model views and custom SQL columns. The most recent `Collection` field added since `createCollection` shipped, and the immediate driver for this ADR.
