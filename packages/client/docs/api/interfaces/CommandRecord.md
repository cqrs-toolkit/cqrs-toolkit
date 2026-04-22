[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandRecord

# Interface: CommandRecord\<TLink, TCommand, TResponse\>

Persisted command record.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

### TResponse

`TResponse` = `unknown`

## Properties

### affectedAggregates?

> `optional` **affectedAggregates**: `AffectedAggregate`\<`TLink`\>[]

Aggregates affected by this command's anticipated events, derived at enqueue time.
Each entry carries the canonical streamId (the chain/concurrency key from the
event) and the EntityId-aware TLink for reconciliation across EntityRef lifecycles.

---

### attempts

> **attempts**: `number`

Number of send attempts

---

### blockedBy

> **blockedBy**: `string`[]

Commands blocked by this command

---

### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity — associates this command's events with the correct data scope. Serialized as JSON in SQL storage.

---

### commandId

> **commandId**: `string`

Unique command identifier (client-generated)

---

### commandIdPaths?

> `optional` **commandIdPaths**: `Record`\<`string`, [`EntityRef`](EntityRef.md)\>

Resolved paths to EntityRef (or EntityTLink for Link-shaped fields) values in the
command record, captured at enqueue time. Keyed by JSONPath rooted at the command
object (e.g. `$.data.notebookId`, `$.path.id`). Used to strip/restore EntityRefs
for storage and handler re-runs, derive auto-dependencies from `ref.commandId`,
and prune entries as tempIds resolve to serverIds.

---

### createdAt

> **createdAt**: `number`

Creation timestamp

---

### creates?

> `optional` **creates**: [`CreateCommandConfig`](CreateCommandConfig.md)

Create command configuration (present only for commands that create aggregates)

---

### data

> **data**: `TCommand`\[`"data"`\]

Command data

---

### dependsOn

> **dependsOn**: `string`[]

Commands this command depends on (must complete first)

---

### error?

> `optional` **error**: `IException`\<`unknown`\>

Error information if failed

---

### fileRefs?

> `optional` **fileRefs**: `FileRef`[]

File attachments — metadata at rest, hydrated with Blob data before send().

---

### lastAttemptAt?

> `optional` **lastAttemptAt**: `number`

Timestamp of last send attempt

---

### modelState?

> `optional` **modelState**: `unknown`

Read model snapshot the user had when the command was submitted. Used by anticipated event processors as input state.

---

### path?

> `optional` **path**: `unknown`

URL path template values for command sender URL expansion.

---

### pendingAggregateCoverage?

> `optional` **pendingAggregateCoverage**: `string`

Pipeline coverage tracking for the `'succeeded' → 'applied'` transition. Populated
by the CommandQueue success path; consumed + updated by the server data pipeline.

JSON-encoded on-disk. After parse:

- `'events'` — server response carried events; rule 1 (pipeline drain of those
  events) will mark the command applied.
- `Record<streamId, stringifiedBigInt>` — server response carried no events;
  rule 2 (per-aggregate revision / cache-key eviction) removes entries as
  coverage accrues. Empty map → command transitions to `'applied'`.

Absent for commands not yet in `'succeeded'` status. The pipeline's in-flight
filter on `'succeeded'` guarantees every in-scope command has this populated.
See `_active-plans/command-applied.md` §3.2.

---

### postProcess?

> `optional` **postProcess**: [`PostProcessPlan`](PostProcessPlan.md)

Post-processing instructions from the domain executor

---

### revision?

> `optional` **revision**: `string` \| [`AutoRevision`](AutoRevision.md)

Revision for optimistic concurrency. AutoRevision markers are resolved before send.

---

### seq

> **seq**: `number`

Sequence number for stable submit-order sorting. Assigned by CommandStore;
SQL autoincrement is authoritative on disk — this value is read-only from
the storage perspective.

---

### serverResponse?

> `optional` **serverResponse**: `TResponse`

Server response on success

---

### service

> **service**: `string`

Target service for the command

---

### status

> **status**: [`CommandStatus`](../type-aliases/CommandStatus.md)

Current status

---

### type

> **type**: `TCommand`\[`"type"`\]

Command type (e.g., 'CreateTodo', 'UpdateUser')

---

### updatedAt

> **updatedAt**: `number`

Last update timestamp
