# Local (anticipated) event metadata

## Status

Implemented 2026-05-12. Captured here as the design record; not yet promoted to an ADR — kept open in case patterns from consumer integration force a re-shape.

## Driver

A consumer (swifttt) creating descendant entities (e.g. milestone under a project) wants ancestor-scoping ids on the resulting read-model row — `tenantId`, `workspaceId`, `projectId`. The data sources are split:

- `command.headers` carries `tenantId` (already wired).
- `command.path` carries `projectId`.
- `command.data` legitimately doesn't carry `workspaceId` (contextual, not user-input).

The server's persisted events carry these as **event metadata** (`metadata.inTenant`, etc., not in the event payload). The server's read-model processor uses metadata to project ancestor ids onto rows.

The client previously had no metadata channel on local (anticipated) events at all — `IAnticipatedEvent` was `{ type, data, streamId }` with metadata explicitly TBD'd in the JSDoc. The local projector therefore couldn't construct rows that matched the server's shape, and the optimistic UI either flickered (row briefly without ancestor ids until records refetch arrived) or required out-of-band threading via cacheKey scopeParams (rejected — see "Alternatives" below).

## Decision

`IAnticipatedEvent` gains an optional `metadata?: Record<string, unknown>` field. Looser than ddd-es's `EventMetadata` — no required `correlationId` or tracing fields (those are server-side only).

Handlers stamp metadata when constructing anticipated events; projectors read from `event.metadata?.<key>` uniformly across anticipated and persisted events (both shapes have `metadata` accessible by key).

```ts
export interface IAnticipatedEvent<...> {
  type: Type
  data: Data
  streamId: string
  metadata?: Record<string, unknown>  // ← added
}
```

For the milestone driver: handler reads `command.headers['x-tenant-id']` (potentially an EntityRef when the parent CreateTenant is in flight), stamps `metadata: { inTenant: ... }`. Projector reads `event.metadata?.inTenant` → writes to `row.tenantId`. `idReferences` on the collection declares `$.tenantId → TenantAggregate`; ref resolution rewrites the row when the parent resolves. Single source of truth (the event), single declaration (idReferences).

## Implementation

Six touch points:

1. **`IAnticipatedEvent`** ([`packages/client/src/core/command-lifecycle/AnticipatedEventShape.ts`](../../../../packages/client/src/core/command-lifecycle/AnticipatedEventShape.ts)) — add optional `metadata`.
2. **`AnticipatedEvent`** ([`packages/client/src/types/events.ts`](../../../../packages/client/src/types/events.ts)) — same field on the runtime variant carried alongside library metadata (id/createdAt/persistence/commandId).
3. **`CachedEventRecord`** ([`packages/client/src/storage/IStorage.ts`](../../../../packages/client/src/storage/IStorage.ts)) — add `metadata: string | null` (JSON-serialized).
4. **SQL schema** ([`packages/client/src/storage/schema/client-schema.ts`](../../../../packages/client/src/storage/schema/client-schema.ts)) — add nullable `metadata TEXT` column on `cached_events`. Per the pre-release no-back-compat policy, OPFS wipe on update; no migration is built.
5. **Persistence + hydration**:
   - [`EventCache.cacheAnticipatedEvent(s)`](../../../../packages/client/src/core/event-cache/EventCache.ts) writes `JSON.stringify(event.metadata)` (or `null` when absent).
   - [`EventCache.cacheServerEvent(s)`](../../../../packages/client/src/core/event-cache/EventCache.ts) writes `JSON.stringify(event.metadata)` (always present on server events per ddd-es).
   - [`AnticipatedEventHandler.getAnticipatedEvents`](../../../../packages/client/src/core/command-lifecycle/AnticipatedEventHandler.ts) hydrates metadata from the stored string.
   - [`AnticipatedEventHandler.onApplyAnticipatedOp`](../../../../packages/client/src/core/command-lifecycle/AnticipatedEventHandler.ts) forwards `raw.metadata` into the cache write (was previously dropped on a destructure-and-rebuild).
   - [`SyncManager`](../../../../packages/client/src/core/sync-manager/SyncManager.ts)'s anticipated-event regeneration path persists metadata too.
6. **Projector signature** ([`packages/client/src/core/event-processor/types.ts`](../../../../packages/client/src/core/event-processor/types.ts)) — `EventProcessor`'s first argument is now the full event (`TEvent`), not `event.data`. The three call sites ([`SyncManager`](../../../../packages/client/src/core/sync-manager/SyncManager.ts), [`AnticipatedEventHandler.onApplyAnticipatedOp`](../../../../packages/client/src/core/command-lifecycle/AnticipatedEventHandler.ts), [`reconcilePendingCommands`](../../../../packages/client/src/core/sync-manager/reconcilePendingCommands.ts)) now pass the event object so projectors can read `event.metadata?.inTenant` directly. This was a same-session correction — initial implementation kept the legacy `event.data`-only signature, but that left the `event.metadata` access claim in this exploration impossible to honor. Projector implementations across demos and tests migrated to `({ data }: EventType, _state, ctx) => ...` destructuring, which keeps existing bodies untouched while opting consumers into the wider event shape; processors that want metadata switch to `({ data, metadata }: EventType, ...)`.

EntityRef-in-metadata round-trips as plain JSON shape (with the ref's enumerable fields preserved) — same approach the existing `data` field uses. Downstream consumers read by field access; ref resolution operates on the declared row paths via `idReferences` regardless of whether the value originated from data or metadata.

## Alternatives considered

**cacheKey-as-source.** `ProcessorContext` could carry the cacheKey, and projectors could read `cacheKey.scopeParams.tenantId` to populate the row. Rejected — couples two abstractions that shouldn't touch (cacheKey is for scoping/seeding, not row-data source) and forces double-declaration when scope params contain unresolved EntityRefs (the same value would need to be both a scope-param-stamp source and an `idReferences` target).

**Auto-stamp `Collection.scopeParamFields`.** A declarative list on Collection that copies cacheKey scopeParams onto every row at projection time. Same coupling concerns as above; also forces the convention that every key in scopeParams is a row field, which doesn't hold for filter-style scopes.

**`command.metadata` as a fourth channel** (alongside data/path/headers). Considered in a parallel design thread. Rejected because it solves the wrong layer — handlers already have access to ancestor ids via `command.headers`/`command.path`; the missing piece was the _event-side_ metadata channel for the handler's output, not a new command-side input channel.

**Strict `metadata` (required, default `{}`).** Mirrors ddd-es's required `IEvent.metadata`. Rejected for the first cut — most events won't have metadata; required would force `metadata: {}` at every existing construction site (handler returns, fixtures) for no behavioural gain. Optional with `event.metadata?.foo` access at read sites is the lower-friction shape. Migration to required-with-default later is straightforward if patterns demand it.

**Mirror ddd-es `EventMetadata` shape** (with `correlationId` etc.). Rejected — server-side fields like `correlationId` aren't needed on the client (no cross-service tracing for in-flight optimistic events). Loose `Record<string, unknown>` lets handlers carry whatever app-domain fields they want without forcing them through a tracing-shaped envelope.

## Consequences

### Operational

#### Gains

- Local read-model rows match server-projected row shape immediately for any field carried in event metadata. No flicker on confirm.
- Remote-WS path also benefits: client B's projector sees the same `metadata.inTenant` on canonical events the server produces — populated from creation, not waiting for records refetch.
- Closes a long-standing structural gap (the "TBD" on `IAnticipatedEvent.metadata`) that downstream features kept tripping over.

### Coding

#### Gains

- Projector code reads from `event.metadata?.<key>` uniformly across anticipated and persisted events. Single API.
- Handlers can carry app-domain context into events without inventing per-domain plumbing.

#### Costs

- Storage schema change forces an OPFS wipe per the pre-release no-back-compat policy. (One-time cost, well-precedented.)
- Adds a JSON-serialize / parse pair on every cached event. Tiny per event; bounded by the total event cache volume.

## Related

- Driver originated in [`@cqrs-toolkit/hypermedia-client`](../../hypermedia-client/_overview.md)'s milestone/project gap discussion.
- Reuses the existing `idReferences` ref-resolution mechanism on the row, unchanged.
- The pre-release no-back-compat policy that makes the SQL schema change painless is captured in repo-wide [ADR-0001](../../../decisions/0001-pre-release-no-back-compat.md) (referenced; not introduced here).
