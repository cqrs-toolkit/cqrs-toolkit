[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandRecord

# Interface: CommandRecord\<TLink, TCommand, TResponse\>

Persisted command record.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../type-aliases/EnqueueCommand.md)

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

Subset of `dependsOn` commandIds still gating this command — those that
have not yet reached terminal status. Entries drop off as deps complete;
when this list empties, status flips from 'blocked' to 'pending'.

Stored flat (no source tag) — the source for any entry here can be
looked up by joining with the matching `dependsOn` record.

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

> **dependsOn**: [`CommandDependency`](CommandDependency.md)[]

Source-tagged dependencies this command must wait on. Each entry carries
the upstream `commandId` and the [origin](../type-aliases/DependencySource.md) that
produced it, which the cascade walk uses to decide whether a non-success
terminal upstream propagates as a cancellation (hard) or simply unblocks
this command for an independent attempt (soft).

---

### error?

> `optional` **error**: `IException`\<`unknown`\>

Error information if failed

---

### fileRefs?

> `optional` **fileRefs**: `FileRef`[]

File attachments — metadata at rest, hydrated with Blob data before send().

---

### headers?

> `optional` **headers**: `Record`\<`string`, [`EntityId`](../type-aliases/EntityId.md)\>

Escape-hatch envelope headers — same shape as
HandlerCommand.headers.

Stored with [EntityRef](EntityRef.md)s intact at declared positions; the cascade
rewrites them in-place to server-id strings when the producing
command resolves. By the time the command is dispatched to
[ICommandSender.send](ICommandSender.md#send) every value is a plain string.

---

### lastAttemptAt?

> `optional` **lastAttemptAt**: `number`

Timestamp of last send attempt

---

### modelState?

> `optional` **modelState**: `unknown`

Read-model snapshot the user was operating against when the command was submitted.
Captured at submit, persisted durably with the command record, and immutable thereafter.
This becomes the `initial` half of the [HandlerState](../type-aliases/HandlerState.md) the command-level handler
functions (validate, validateAsync, handler) receive. Re-runs receive the post-server-event
view as a separate `updated` companion (see [HandlerState](../type-aliases/HandlerState.md)).

---

### path?

> `optional` **path**: `unknown`

URL path template values for command sender URL expansion.

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
