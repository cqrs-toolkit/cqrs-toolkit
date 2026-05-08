# 17\. Aggregate Configuration

## 17.1 Purpose

Aggregates are the source of truth for entity identity and stream ownership.
Collections consume events from aggregates and build read models.

The client currently conflates these two concepts — `Collection` owns both `getStreamId` (an aggregate concern) and `matchesStream` (a collection routing concern).
Entity ID location in event data is hardcoded to `data.id`.
Reconciliation of client-generated IDs to server-assigned IDs relies on inferring which fields are entity IDs from command data shapes.

`AggregateConfig` formalizes the aggregate as a first-class concept on the client.
Collections declare which aggregate they represent and which read model fields reference other aggregates.
The reconciliation system uses these declarations to update ID fields explicitly — no inference from command data shapes.

---

## 17.2 Types

```typescript
/** A string representing a JSONPath expression (RFC 9535 subset per §15.5.2.1). */
type JSONPathExpression = string
```

### 17.2.1 AggregateConfig

```typescript
type AggregateConfig<TLink extends Link> = Omit<TLink, 'id'> & {
  /** Build a stream ID from an entity ID. Accepts EntityId — implementations must
   *  call entityIdToString() to extract the plain string. */
  getStreamId(entityId: EntityId): string
}
```

### 17.2.2 IdReference

```typescript
interface IdReference {
  /** JSONPath to the ID field in read model data. */
  path: JSONPathExpression
  /** Aggregate type this ID references. */
  aggregate: string
}
```

### 17.2.3 Collection changes

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

## 17.3 Reconciliation

### 17.3.1 Current behavior

When a create command with a temporary ID succeeds, the reconciliation system:

1. Builds an `idMap` of `clientId → serverId` from the server response.
2. Rewrites pending command data by walking each command's declared `commandIdReferences` paths (JSONPath) against `idMap`.
3. Regenerates anticipated events with updated IDs.
4. `patchEntityId` in `EventProcessorRunner` replaces `data.id` in overlay events using string comparison.

### 17.3.2 New behavior

The `idReferences` declaration on each collection provides an explicit map of which read model fields are entity IDs and which aggregate they reference.

When a create command succeeds with an ID mapping (`clientId → serverId`):

1. The reconciliation system identifies the aggregate type from the command's `creates` config.
2. It looks up all collections with `idReferences` entries referencing that aggregate type.
3. For each matching collection + path: it knows exactly which read model field to update and where.
4. `patchEntityId` uses the collection's aggregate config to identify the entity's own ID path (always `$.id` by convention) and uses `entityIdToString` for comparison.

No inference from command data shapes.
Dependency auto-wiring flows through `EntityRef.commandId` captured at the declared paths, so no separate parent-reference config is needed.

---

## 17.4 Stream ID construction

`getStreamId` moves from `Collection` to `AggregateConfig`.
Command handlers import the aggregate config and call `aggregate.getStreamId(entityId)` when producing anticipated events.

Consumers define aggregate configs alongside their collection configs:

```typescript
const notebookAggregate: AggregateConfig<ServiceLink> = {
  type: 'Notebook',
  service: 'nb',
  getStreamId: (entityId) => `Notebook-${entityIdToString(entityId)}`,
}

const notebooksCollection: Collection<ServiceLink> = {
  name: 'notebooks',
  aggregate: notebookAggregate,
  matchesStream: (streamId) => streamId.startsWith('Notebook-'),
  // ... seed config
}
```

---

## 17.5 Scope

This specification covers standard (1:1 aggregate) collections.

Composite collections that consume events from multiple aggregates are a future extension.
When needed, a `CompositeCollection` type will require `aggregates: AggregateConfig[]` (instead of scalar) and mandatory `idReferences`.
