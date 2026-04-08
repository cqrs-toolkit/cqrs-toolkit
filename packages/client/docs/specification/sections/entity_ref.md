# 15\. EntityRef (Client-Side Entity Lifecycle Tracking)

## 15.1 Purpose

EntityRef makes entity lifecycle state visible **in read model data** for locally-created entities whose IDs are pending server confirmation.

Every system that touches ID values — cache keys, queries, command submission, URL routing — must be able to inspect `EntityRef` and react to the lifecycle state without separate metadata channels or manual wiring.

EntityRef enables:

- automatic cache key reconciliation when temporary IDs are replaced by server-assigned IDs

- automatic command dependency derivation from entity references

- automatic field rewriting in dependent commands without consumer-provided config

- deep entity graph creation (arbitrary depth) without per-level consumer wiring

---

## 15.2 Core types

```typescript
/**
 * Entity reference carrying lifecycle metadata.
 * Present in read model data for locally-created entities with pending IDs.
 * Replaced by a plain string when the server confirms the entity.
 *
 * EntityRef carries only identity and command lifecycle — not entity type.
 * Type information comes from the surrounding context: the read model
 * collection, the field name, or the Link object the ID is embedded in.
 */
interface EntityRef {
  /** Discriminant for runtime identification. */
  __entityRef: true
  /** The current entity ID (client-generated temporary). */
  entityId: string
  /** The command that created this entity. */
  commandId: string
  /** Whether the server will replace this ID. */
  idStrategy: 'temporary' | 'permanent'
}

/**
 * An entity ID field in read model data.
 * Plain string for server-confirmed entities.
 * EntityRef for locally-created entities with pending IDs.
 */
type ID = string | EntityRef

/** Type guard for EntityRef values. */
function isEntityRef(value: unknown): value is EntityRef

/** Extract the plain string ID from an ID value. */
function idToString(id: ID): string
```

Consumer read model types use `ID` for all entity identity fields:

```typescript
interface Notebook {
  id: ID
  title: string
}

interface Note {
  id: ID
  notebookId: ID
  title: string
  body: string
}
```

---

## 15.3 Lifecycle

### 15.3.1 Entity creation via anticipated events

When a create command is enqueued and anticipated events produce read model entries, ID fields are hydrated as `EntityRef` objects:

```typescript
// Anticipated event produces read model:
{
  id: { __entityRef: true, entityId: 'nb-temp-1', commandId: 'cmd-1', idStrategy: 'temporary' },
  title: 'My Notebook',
}
```

### 15.3.2 Parent references in child entities

When a child entity references a parent that was also locally created, the parent ID field carries the parent's `EntityRef`:

```typescript
// Note created under a locally-created notebook:
{
  id: { __entityRef: true, entityId: 'note-temp-1', commandId: 'cmd-2', idStrategy: 'temporary' },
  notebookId: { __entityRef: true, entityId: 'nb-temp-1', commandId: 'cmd-1', idStrategy: 'temporary' },
  title: 'First Note',
}
```

### 15.3.3 Server confirmation

When the creating command succeeds:

1. The Command Queue reconciles the ID (`nb-temp-1` → `nb-srv-1`).
2. Server response events produce a new read model entry with plain string IDs.
3. The old anticipated entry (with `EntityRef`) is cleaned up.
4. Child commands are rewritten and their anticipated events regenerated.
5. In the regenerated child read model, the parent field transitions to a plain string (because the parent command has completed), while the child's own ID remains an `EntityRef` until its command completes.

```typescript
// After cmd-1 (notebook) completes, cmd-2 (note) regenerates:
{
  id: { __entityRef: true, entityId: 'note-temp-1', commandId: 'cmd-2', idStrategy: 'temporary' },
  notebookId: 'nb-srv-1',    // ← plain string, parent is confirmed
  title: 'First Note',
}
```

### 15.3.4 Deep graph cascade

For entity graphs of arbitrary depth, reconciliation cascades top-down through the Command Queue's dependency and rewrite machinery.
At each level, the parent reference transitions from `EntityRef` to `string` as the parent's command completes.
No consumer-side wiring is needed — the cascade is automatic.

---

## 15.4 ID strategy

### 15.4.1 Temporary IDs

When `idStrategy === 'temporary'`, the client-generated ID is a placeholder.
The server assigns the permanent ID on confirmation.
The cache key system must reconcile the old temporary ID to the new server-assigned ID.

### 15.4.2 Permanent IDs

When `idStrategy === 'permanent'`, the client-generated ID is the final ID.
The `EntityRef` still carries lifecycle metadata — the command has not completed and the server has not confirmed.
On confirmation, the `EntityRef` transitions to a plain string with the same value.

The cache key system must treat permanent-strategy `EntityRef` values as stable — no ID reconciliation is needed, but command completion is still relevant for knowing the entity is confirmed.

---

## 15.5 Boundaries

### 15.5.1 Read model hydration (EntityRef injection point)

`EntityRef` is injected at the boundary where anticipated events become read model data.
The event processor (or a layer above it) hydrates ID fields for anticipated events using metadata from the originating command:

- **Entity's own ID**: from the command's `creates` config — if `idStrategy === 'temporary'`, wrap the ID field in `EntityRef`.
- **Parent reference fields**: from `entityRefData` on the command record (see §15.5.2) — if a field was submitted as `EntityRef`, preserve it in the read model.

Server events always produce plain string IDs.
`EntityRef` must never appear in server-seeded read model data.

### 15.5.2 Command submission (EntityRef extraction point)

When the consumer submits a command, they pass read model ID values directly:

```typescript
client.submit({
  command: {
    type: 'CreateNote',
    data: { notebookId: notebook.id, title: 'First Note' },
    //                  ↑ ID value — could be string or EntityRef
  },
  cacheKey: notesCacheKey,
})
```

At the enqueue boundary, the library must:

1. Walk the command data fields and identify `EntityRef` values.
2. Extract them into a separate `entityRefData` map stored on the command record.
3. Replace them with plain `entityId` strings in the command data.

```
Consumer submits:
  data: { notebookId: EntityRef{ entityId: 'nb-1', commandId: 'cmd-1', ... }, title: 'hello' }

Library splits at enqueue:
  command.data:          { notebookId: 'nb-1', title: 'hello' }
  command.entityRefData: { notebookId: EntityRef{ ... } }
```

The command pipeline (validation, handlers, server payloads) always works with plain strings.
`entityRefData` is library-internal metadata on the command record.

#### entityRefData

`entityRefData` is a `Record<string, EntityRef>`.
Each key is a JSONPath expression (see §15.5.2.1) addressing a location in the command data.
Each value is the `EntityRef` found at that location.

All keys use JSONPath syntax with the `$` root identifier, regardless of depth.

Default extraction (top-level scan):

```typescript
{
  '$.notebookId': EntityRef{ entityId: 'nb-1', commandId: 'cmd-1', idStrategy: 'temporary' },
}
```

Declared path extraction (nested and array structures):

```typescript
{
  '$.forms[0].id': EntityRef{ entityId: 'form-1', commandId: 'cmd-3', idStrategy: 'temporary' },
  '$.forms[1].id': EntityRef{ entityId: 'form-2', commandId: 'cmd-4', idStrategy: 'temporary' },
  '$.metadata.orgId': EntityRef{ entityId: 'org-1', commandId: 'cmd-1', idStrategy: 'temporary' },
}
```

Re-injection (§15.5.1) uses the same paths to set `EntityRef` values back into read model data.

#### 15.5.2.1 Entity ref path expressions

Path expressions implement a subset of JSONPath (RFC 9535).
Only structural access operators are supported — no query, filter, or selection operators.

Supported RFC 9535 operators:

| Operator          | Syntax     | Usage                                                                        |
| ----------------- | ---------- | ---------------------------------------------------------------------------- |
| Root identifier   | `$`        | Required prefix for all paths                                                |
| Dot member        | `.name`    | Object property access                                                       |
| Bracket member    | `['name']` | Object property access for field names containing dots or special characters |
| Wildcard selector | `[*]`      | Iterate all elements of an array (declaration paths only)                    |
| Index selector    | `[n]`      | Access a specific array element (extracted `entityRefData` output only)      |

Not supported: slice (`[start:end]`), union (`[a,b]`), recursive descent (`..`), filter (`[?()]`).

`entityRefPaths` on a command handler registration declares paths where `EntityRef` values may appear in nested or array structures.
Declaration paths use `[*]` for array traversal.
Multiple `[*]` segments may appear in a single path for nested arrays.

```typescript
{
  commandType: 'CreateProjectFromTemplate',
  entityRefPaths: ['$.forms[*].id', '$.metadata.orgId', '$.sections[*].items[*].parentId'],
}
```

The library must resolve declaration paths against command data at extraction time, expanding `[*]` to concrete `[n]` indices for each matched element.

### 15.5.3 Handlers and validation

Command handlers, schema validation (Zod), and `validateAsync` all receive plain string data.
The handler API is unaffected.
`entityRefData` extraction occurs before validation runs.

### 15.5.4 Submit result enrichment

When a command creates entities, the submit result must surface the created entity IDs so the consumer has them immediately without a separate query.

For single-entity creates (the common case):

```typescript
const result = await client.submit({ command, cacheKey })
// result.value.created — the EntityRef for the created entity
```

For commands that create multiple entities, the consumer must be able to read all created entity IDs.

The existing `getCommandEntities(commandId, collection)` method already provides this for the multi-entity case.
The submit result enrichment adds the primary created entity for ergonomics — it does not replace `getCommandEntities` for commands that produce multiple entities.

### 15.5.5 Cache key derivation

When `registerCacheKey` receives identity fields containing `EntityRef` values:

- **Entity cache key**: `link.id` is an `EntityRef` → the system knows the ID is pending, the `commandId` that will resolve it, and the `idStrategy`.
- **Scope cache key**: a `scopeParams` value is an `EntityRef` → same.

The cache key system auto-wires reconciliation from the embedded metadata.
No separate pending-ID mapping or pending-mappings parameter is needed.

### 15.5.6 Three-way merge

Field-level diffing via `JSON.stringify` correctly distinguishes `EntityRef` from a plain string for the same logical ID.
When server data arrives with `orgId: 'org-srv-1'` and local data has `orgId: EntityRef{entityId: 'org-1'}`, the merge must prefer the server value.

---

## 15.6 Derived automation

### 15.6.1 Automatic `dependsOn`

When `entityRefData` contains `EntityRef` values, the library must automatically add their `commandId` entries to the command's `dependsOn` list.
Explicit `dependsOn` for parent references is unnecessary.

### 15.6.2 Automatic field rewriting

The field rewriting system uses `entityRefData` to determine exactly which fields are entity references — the keys in `entityRefData`.
No field scanning, `parentRef` config lookup, or `fromCommand` type-matching is needed.

---

## 15.7 URL encoding

`EntityRef` values are encoded for URL parameters using a prefix and base64:

```
Plain string ID:  /notebooks/nb-srv-1
EntityRef ID:     /notebooks/x_eyJlbnRpdHlJZCI6Im5iLTEiLC4uLn0=
```

The `x_` prefix distinguishes encoded `EntityRef` from plain IDs.
The library exports encode/decode helpers for URL parameter handling:

```typescript
/** Encode an ID value for use in a URL parameter. */
function encodeIdParam(id: ID): string

/** Decode a URL parameter back to an ID value. */
function decodeIdParam(param: string): ID
```

When the server ID arrives, the URL can be updated to the clean server ID.
If the user refreshes with an `EntityRef`-encoded URL, the decoded `EntityRef` provides the `commandId` for re-wiring reconciliation (if the command is still pending) or the `entityId` for ID mapping lookup (if the command has already completed).

---

## 15.8 Consumer utilities

### 15.8.1 `idToString(id: ID): string`

Extracts the plain `entityId` string from an `EntityRef`, or returns the string as-is.
Used when the consumer needs a raw string for filtering, comparison, or display.

```typescript
// Comparison
notebooks.items.find(n => idToString(n.id) === idToString(selectedId))

// Display
<span>{idToString(notebook.id)}</span>
```

---

## 15.9 Serialization

Read model data is stored as JSON.
`EntityRef` objects serialize naturally.
When read model data is deserialized from storage, the system must recognize objects with `__entityRef: true` and hydrate them as `EntityRef` values so that `isEntityRef()`, cache key wiring, and all other `EntityRef`-aware paths operate correctly.

---

## 15.10 Framework integration (Solid)

### 15.10.1 List query store keying

Solid's `reconcile()` with `key: 'id'` uses strict equality on the `id` field value.
`EntityRef` objects break this because different object references are not `===` equal.

The `createListQuery` primitive must handle this by:

1. Injecting a `_id: string` field on each item (always `idToString(item.id)`).
2. Using `key: '_id'` in the `reconcile` call.

Consumer components are unaffected — `<For each={query.items}>` works as before.

### 15.10.2 Pending and reconciled detection

List queries must detect **pending** items (where `id` is an `EntityRef`) in addition to already-reconciled items (where `_clientMetadata.clientId` differs from the current `id`).

---

## 15.11 Hypermedia client

The hypermedia client has schema knowledge from API documentation.
It knows which fields are entity ID references from schema annotations.
This allows it to:

- Automatically hydrate ID fields to `EntityRef` when building read models from anticipated events.
- Automatically extract `entityRefData` when the consumer submits commands.
- Handle schema validation transparently (schemas expect string IDs, `EntityRef` is extracted before validation).

Consumers of the hypermedia client never interact with `EntityRef` directly — the client handles the lifecycle transparently for properly documented ID properties.
