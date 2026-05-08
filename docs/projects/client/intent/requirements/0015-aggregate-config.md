# 15\. Aggregate Configuration

## 15.1 Purpose

Aggregates are the source of truth for entity identity and stream ownership.
Collections consume events from aggregates and build read models.

The client currently conflates these two concepts — `Collection` owns both `getStreamId` (an aggregate concern) and `matchesStream` (a collection routing concern).
Entity ID location in event data is hardcoded to `data.id`.
Reconciliation of client-generated IDs to server-assigned IDs relies on inferring which fields are entity IDs from command data shapes.

`AggregateConfig` formalizes the aggregate as a first-class concept on the client.
Collections declare which aggregate they represent and which read model fields reference other aggregates.
The reconciliation system uses these declarations to update ID fields explicitly — no inference from command data shapes.

---

## 15.2 Types

```typescript
/** A string representing a JSONPath expression (RFC 9535 subset per `0014 §14.5.2.1`). */
type JSONPathExpression = string
```

### 15.2.1 AggregateConfig

```typescript
interface AggregateConfig<TLink extends Link> {
  /** Service identifier (only present when TLink is ServiceLink). */
  service: TLink extends ServiceLink ? TLink['service'] : never
  /** Aggregate type identifier. */
  type: TLink['type']
  /** Build a stream ID from an entity ID. Accepts EntityId —
   *  implementations must call entityIdToString() to extract the plain string. */
  getStreamId(entityId: EntityId): string
  /** Returns the Link minus its id field — used as a matcher for
   *  identifying which aggregate a Link or LinkIdReference points at. */
  getLinkMatcher(): Omit<TLink, 'id'>
}
```

The library exports a `ClientAggregate<TLink>` class that implements this interface for consumer convenience — pass `{ service, type, getStreamId }` to its constructor and `getLinkMatcher` is computed automatically from `service` and `type`.

### 15.2.2 IdReference

`IdReference` is a discriminated union, distinguishing paths that point to plain string IDs from paths that point to `Link` objects (which carry their own type discriminator):

```typescript
/** Plain ID field — path points to a string (the aggregate ID itself). */
interface DirectIdReference<TLink extends Link> {
  aggregate: AggregateConfig<TLink>
  path: JSONPathExpression
}

/** Link field — path points to a Link object containing type+id.
 *  Supports multiple aggregates for union/polymorphic Link references. */
interface LinkIdReference<TLink extends Link> {
  aggregates: AggregateConfig<TLink>[]
  path: JSONPathExpression
}

type IdReference<TLink extends Link> = DirectIdReference<TLink> | LinkIdReference<TLink>
```

Response-side variants (used in `responseIdReferences` on command handler registrations, see [`§4.6.2`](0004-command-queue.md#462-post-processing)) extend the above with an optional `revisionPath`:

```typescript
interface ResponseDirectIdReference<TLink extends Link> extends DirectIdReference<TLink> {
  revisionPath?: JSONPathExpression
}

interface ResponseLinkIdReference<TLink extends Link> extends LinkIdReference<TLink> {
  revisionPath?: JSONPathExpression
}
```

`revisionPath` lets the reconcile step update each aggregate chain's `lastKnownRevision` from the response alongside the id mapping.

### 15.2.3 Collection changes

`Collection` gains an `aggregate` field and optional `idReferences`.
`getStreamId` moves from `Collection` to `AggregateConfig`.

```typescript
interface Collection<TLink extends Link> {
  name: string
  /** The aggregate this collection represents (1:1 for standard collections). */
  aggregate: AggregateConfig<TLink>
  /** ID fields in read model data that reference other aggregates.
   *  Used by the reconciliation system to update ID fields when temporary
   *  IDs are replaced by server-assigned IDs. */
  idReferences?: IdReference[]
  /** Match incoming event stream IDs to determine if this collection should process them. */
  matchesStream(streamId: string): boolean
  // ... existing seed, fetch, processor config unchanged
}
```

---

## 15.3 Reconciliation

The `idReferences` declaration on each collection provides an explicit map of which read model fields contain entity IDs and which aggregate they reference. The reconciliation system uses this — together with the corresponding declarations on command handler registrations (`commandIdReferences`, `responseIdReferences`; see [`§4.6.2`](0004-command-queue.md#462-post-processing)) — to walk the id mapping without inferring from command-data shapes.

When a create command succeeds with an ID mapping (`clientId → serverId`):

1. The reconciliation system identifies the affected aggregate(s) from the command's `creates` config and `responseIdReferences`.
2. For each affected aggregate, it looks up all collections whose `idReferences` reference that aggregate.
3. For each matching collection + path, it walks read-model records and rewrites the matching client IDs to server IDs. The entity's own ID at `$.id` is auto-injected by `resolveConfig` from the collection's `aggregate` — consumers don't declare it manually; only cross-aggregate references need explicit `idReferences` entries.

Dependency auto-wiring flows through `EntityRef.commandId` captured at declared paths (see [§14.6.1](0014-entity-ref.md#1461-automatic-dependson)) — no separate parent-reference config needed.

---

## 15.4 Stream ID construction

`getStreamId` moves from `Collection` to `AggregateConfig`.
Command handlers import the aggregate config and call `aggregate.getStreamId(entityId)` when producing anticipated events.

Consumers define aggregate configs alongside their collection configs:

```typescript
const notebookAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Notebook',
  getStreamId(id: EntityId): string {
    return `nb.Notebook-${entityIdToString(id)}`
  },
})

const notebooksCollection: Collection<ServiceLink> = {
  name: 'notebooks',
  aggregate: notebookAggregate,
  matchesStream: (streamId) => streamId.startsWith('nb.Notebook-'),
  // ... seed config
}
```

The streamId convention `${service}.${Type}-${id}` lets a stream identifier carry its service namespace explicitly — useful in multi-service apps so streamIds don't collide across services for entities sharing a type name. Consumers are free to pick a different convention; the library doesn't parse `streamId` itself.

---

## 15.5 Scope

This specification covers standard (1:1 aggregate) collections.

Composite collections that consume events from multiple aggregates are a future extension.
When needed, a `CompositeCollection` type will require `aggregates: AggregateConfig[]` (instead of scalar) and mandatory `idReferences`.
