# Per-collection event-history storage

## Context

The client today persists only snapshots.
Server events flow through [`EventCache`](../intent/requirements/0006-event-cache.md) as a temporary buffer, get folded through the [event-processor pipeline](../intent/requirements/0008-event-processors.md) into the [read-model store](../intent/requirements/0007-read-model-store.md), and are deleted from the cache after processing.
The final state of each aggregate is all that remains.

A real consumer (the main Swifttt app) has two aggregates that other read models reference **by revision** — i.e. a read model carries a pointer like `{ streamId, revision }` and at render time needs the state of that stream at that revision.
Snapshot-only storage can't answer those lookups.
What's needed is per-collection opt-in to retain the full event history for that collection's aggregates and a query surface that returns state at an arbitrary revision.

The hypermedia client should default to snapshot-only — only consumers that explicitly need history pay the storage and recovery cost.

## Observations

- **2026-05-20.** Initial framing. Walked the existing config (`Collection<TLink>` in [`packages/client/src/types/config.ts`](../../../../packages/client/src/types/config.ts)) and the storage layer to locate where the opt-in flag would live and what it would gate.
- **2026-05-20 (continued).** First framing wrongly proposed a new projector responsibility on `Collection`. Corrected: the reducer machinery already exists as [`EventProcessorRegistry`](../intent/requirements/0008-event-processors.md), registered per event type and called via `(event, state, context) → ProcessorReturn`. Historical replay reuses these processors verbatim against an in-memory accumulator instead of the live store. The opt-in is purely a **storage + retention + query** concern; no new reducer concept is required.
- **2026-05-20 (continued).** Invalidation semantics diverge by mode. In snapshot mode, `InvalidateSignal` and gap detection can refetch the current snapshot (lossy by design). In event-history mode, the log is the source of truth and may not be made lossy — invalidation and gap detection must instead fetch the missing event range and append it to the log, then re-fold. This makes `fetchStreamEvents` mandatory (not optional) for event-history collections, and `fetchSeedEvents` similarly mandatory (the snapshot-based `fetchSeedRecords` path would skip history).
- **2026-05-20 (continued).** Append idempotency keys on `event.id`, not `(streamId, revision)`. Anticipated events don't have final revisions — when they carry a revision at all it's a moving local guess stacked on top of the stream's latest server revision (see [`ProcessorContext.revision`](../../../../packages/client/src/core/event-processor/types.ts) — "absent for anticipated events"). The log holds server-acked events only; anticipated events feed the live read-model store via the existing optimistic-then-reconcile flow and are never written to the log. Server events replace anticipated state via the normal reconciliation path.
- **2026-05-20 (continued).** `fetchStreamEvents` needs revision-cursor pagination. Its `FetchStreamEventOptions` already carries `afterRevision: bigint`, but the return type is a flat `IPersistedEvent[]` with no `limit` input and no continuation signal. App-server endpoints already support revision-cursor paging; the demo doesn't exercise it, so the existing signature has gone untested against multi-page histories.

## Tentative shape

### Flag

A boolean on [`ManagedCollectionDef`](../../../../packages/client/src/types/config.ts) for DDL-time provisioning of the event log table:

```ts
interface ManagedCollectionDef {
  type: 'managed'
  name: string
  persistEventHistory?: boolean // default false
  // ...existing columns / indexes
}
```

A refined runtime type alongside the existing `CollectionWithSeedOnInit<TLink>` / `CollectionWithFetchStreamEvents<TLink>` refinements:

```ts
interface CollectionWithEventHistory<TLink> extends Collection<TLink> {
  fetchSeedEvents(opts: FetchSeedEventOptions<TLink>): Promise<SeedEventPage>
  fetchStreamEvents(opts: FetchStreamEventOptions): Promise<FetchStreamEventResult>
}
```

The DDL flag and the runtime refinement travel together — startup validation asserts that a collection whose `ManagedCollectionDef.persistEventHistory` is true is wired with a `CollectionWithEventHistory<TLink>` runtime definition.

A boolean is defensible here because the corrected scope has no co-required fields (the reducer comes from `EventProcessorRegistry`). The discriminated-union framing from the first pass dissolved with the projector correction.

### Storage

A per-collection table `event_log_<name>` provisioned alongside `rm_<name>` when the flag is set. Schema sketch:

- `id` (event id, PRIMARY KEY) — dedup key on append
- `stream_id` (indexed)
- `revision` (bigint) — for `(stream_id, revision)` lookups during replay
- `type`, `data`, `metadata`, `position`, `created_at`

Per-collection rather than central-with-a-collection-column because the consumer-facing operation is "replay one stream of one collection," which is a single-table scan with a tight index; spread isn't a benefit.

### Pagination contract

Extend `FetchStreamEventOptions` and change the return type to surface continuation:

```ts
interface FetchStreamEventOptions {
  ctx: FetchContext
  streamId: string
  afterRevision: bigint
  limit: number // new
}

interface FetchStreamEventResult {
  events: IPersistedEvent[]
  hasMore: boolean
}
```

Explicit `hasMore` is preferable to having callers infer continuation from `events.length === limit`. The latter is a heuristic that fails silently when a server happens to return exactly `limit` events on the last page.

### Append rule

For any collection where `persistEventHistory` is true, every server event the client observes (seed, live WS, command-response, gap-fill) is appended to `event_log_<name>` once, deduped by `event.id`. The append happens at the same point in the pipeline where the event would otherwise be folded — append is a sibling of fold, not a prior step.

Anticipated events flow through the existing optimistic path and write to the read-model store but never to the log. When the server event arrives, normal reconciliation replaces the optimistic state in the store; the server event is appended to the log under its canonical `event.id`.

### Recovery semantics

When the sync pipeline detects a gap (incoming revision > `lastKnownRevision + 1` on a tracked stream) or a processor returns `InvalidateSignal` for an event-history collection:

1. Loop `fetchStreamEvents({ streamId, afterRevision: lastKnownRevision, limit })` until `hasMore: false`.
2. Append every fetched event to the log under its `event.id`.
3. Resume normal processing — the live snapshot in the read-model store re-derives from the events through the existing processor pipeline.

The snapshot-refetch branch never runs for event-history collections.

### Query surface

A new public method that loads events from the log and folds them through the existing `EventProcessorRegistry` against an in-memory accumulator:

```ts
client.getStateAtRevision(collection, streamId, revision): Promise<TModel | undefined>
```

The reducer is the existing per-event-type processor pipeline. Persistence-filtering stays `'Server'` only. The sink is a transient accumulator object, not the live `ReadModelStore`.

### Hypermedia client wrapper

[`createCollection`](../../../../packages/hypermedia-client/src/runtime/createCollection.ts) exposes the flag as an optional option; default is `false` (snapshot mode). Consumers that need history opt in per collection. The wrapper supplies the library-side `fetchSeedEvents` / `fetchStreamEvents` for event-history collections.

## Open

- **Retention.** Unbounded is the simplest mental model. The two consumer aggregates may have long histories. Is there a need for a retention cap (`maxEvents`, time-based), or is "keep everything" acceptable for the foreseeable future?
- **Snapshot intervals.** For long histories, replay from event 0 grows linearly. A common pattern is periodic intermediate snapshots so replay only folds the tail. Out of scope for the first cut, or wanted now?
- **Folded-state caching.** Read models that hold many `{streamId, revision}` references may need a (streamId, revision) → state cache to avoid re-folding on every render. In-memory only, or persisted? Out of scope for the first cut?
- **Live store derivation.** Today the live `ReadModelStore` snapshot is updated by the processor pipeline writing through. For event-history collections, the log is canonical; the snapshot is derivative. Does the snapshot path stay unchanged (events fold to log AND to store), or does the store derive lazily from the log? The former is simpler and lets `list`/`watchList`/`getView` work unchanged; flagged here so the choice is deliberate.
- **DDL on flag flip.** If a consumer changes `persistEventHistory` from false → true after deployment, the event log table needs to be added by migration, and there's no historical data to seed it with (events prior to the flip never landed). Is that a documented limitation, or does the system attempt backfill via `fetchSeedEvents` on first run after the flip?

## Status

Open. Scoping the first concrete cut depends on the retention and snapshot-interval answers — both affect storage envelope sizing for the two consumer aggregates.
