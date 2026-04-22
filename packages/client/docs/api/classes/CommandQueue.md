[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandQueue

# Class: CommandQueue\<TLink, TCommand, TSchema, TEvent\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)

## Implements

- `ICommandQueueInternal`\<`TLink`, `TCommand`\>

## Constructors

### Constructor

> **new CommandQueue**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`eventBus`, `storage`, `fileStore`, `anticipatedEventHandler`, `aggregates`, `readModelStore`, `commandStore`, `mappingStore`, `config?`): `CommandQueue`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

#### Parameters

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### fileStore

`ICommandFileStore`

File store for commands with file attachments.

##### anticipatedEventHandler

`IAnticipatedEventHandler`\<`TLink`, `TCommand`\>

##### aggregates

`IClientAggregates`\<`TLink`\>

##### readModelStore

[`ReadModelStore`](ReadModelStore.md)\<`TLink`, `TCommand`\>

Read-model store — used by the success path to apply best-guess ID rewrites
as local-changes overlays. Must not be used to touch `serverData`.

##### commandStore

[`ICommandStore`](../interfaces/ICommandStore.md)\<`TLink`, `TCommand`\>

##### mappingStore

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md)

##### config?

[`CommandQueueConfig`](../interfaces/CommandQueueConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\> = `{}`

#### Returns

`CommandQueue`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

## Properties

### chains

> `protected` `readonly` **chains**: `AggregateChainRegistry`

In-memory tracking of command chains per aggregate stream.
Keyed by the aggregate's streamId (client and/or server); the registry
keeps both indices of a dual-indexed chain in sync.

`protected` so test subclasses can introspect chain state after
[rebuildChains](#rebuildchains); production access stays through this class's
own methods.

---

### commandEvents

> `protected` `readonly` **commandEvents**: `Subject`\<[`CommandEvent`](../interfaces/CommandEvent.md)\>

---

### events$

> `readonly` **events$**: `Observable`\<[`CommandEvent`](../interfaces/CommandEvent.md)\>

Observable of command events for reactive consumers.
Emits for all command status changes.

#### Implementation of

`ICommandQueueInternal.events$`

## Methods

### advanceChainRevisions()

> **advanceChainRevisions**(`updates`): `void`

Advance chain revisions from server data (WS events, seed records, refetches).
Only updates chains that already exist — does not create new chains.
Compares as bigint; only advances forward, never backwards.

#### Parameters

##### updates

readonly `AdvanceChainRevisionsUpdate`[]

#### Returns

`void`

---

### batchUpdateSyncStatus()

> **batchUpdateSyncStatus**(`params`): `Promise`\<`void`\>

Batch-write the sync pipeline's per-command progress at end-of-batch.

`applied` — commands transitioning from `'succeeded'` to `'applied'` this
batch. Each gets `{ status: 'applied', pendingAggregateCoverage: null,
updatedAt }` written and emits one `'status-changed'` event.
`updated` — commands that stay in `'succeeded'` but had their coverage
record shrink during this batch. Each gets its `pendingAggregateCoverage`
re-persisted (status stays `'succeeded'`); no event is emitted.

**Contract invariants:**

- MUST NOT enqueue a write-queue op. The pipeline calls this from inside
  its own `reconcile-ws-events` op handler — re-entry would deadlock.
- The caller already holds the command records (loaded at batch setup).
  This method must not re-read them from storage.
- A single `storage.updateCommands` call batches both sets.

#### Parameters

##### params

###### applied?

`Iterable`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>, `any`, `any`\>

###### updated?

`Iterable`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>, `any`, `any`\>

#### Returns

`Promise`\<`void`\>

---

### cancelCommand()

> **cancelCommand**(`commandId`): `Promise`\<`Result`\<`void`, [`CommandNotFoundException`](CommandNotFoundException.md) \| [`InvalidCommandStatusException`](InvalidCommandStatusException.md)\>\>

Cancel a pending command.
Cannot cancel commands that are already sending or completed.

#### Parameters

##### commandId

`string`

Command ID to cancel

#### Returns

`Promise`\<`Result`\<`void`, [`CommandNotFoundException`](CommandNotFoundException.md) \| [`InvalidCommandStatusException`](InvalidCommandStatusException.md)\>\>

#### Implementation of

`ICommandQueueInternal.cancelCommand`

---

### clearAll()

> **clearAll**(): `Promise`\<`void`\>

Clear all command state for session destroy.
Pauses, clears retry timers, waits for in-flight, clears anticipated event tracking, deletes all commands.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICommandQueueInternal.clearAll`

---

### commandEvents$()

> **commandEvents$**(`commandId`): `Observable`\<[`CommandEvent`](../interfaces/CommandEvent.md)\>

Observable filtered to a specific command.
Useful for tracking a single command's lifecycle.

#### Parameters

##### commandId

`string`

Command ID to filter for

#### Returns

`Observable`\<[`CommandEvent`](../interfaces/CommandEvent.md)\>

Observable of events for that command

#### Implementation of

`ICommandQueueInternal.commandEvents$`

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Destroy the command queue and release resources.
Waits for any in-flight command processing to settle before returning.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICommandQueueInternal.destroy`

---

### enqueue()

> **enqueue**\<`TData`, `TEvent`\>(`params`): `Promise`\<[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>\>

Enqueue a command with local validation.
Returns immediately with either validation errors or the queued command.

For forms: check result.ok to show validation errors immediately.

#### Type Parameters

##### TData

`TData`

##### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AnticipatedAggregateEventData`\>

#### Parameters

##### params

`EnqueueParams`\<`TLink`, `TData`\>

#### Returns

`Promise`\<[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>\>

Enqueue result with validation status

#### Implementation of

`ICommandQueueInternal.enqueue`

---

### enqueueAndWait()

> **enqueueAndWait**\<`TData`, `TEvent`, `TResponse`\>(`params`): `Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Convenience: enqueue and wait for completion in one call.
Best for simple form submissions.

#### Type Parameters

##### TData

`TData`

##### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AnticipatedAggregateEventData`\>

##### TResponse

`TResponse`

#### Parameters

##### params

`EnqueueAndWaitParams`\<`TLink`, `TData`\>

#### Returns

`Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Combined enqueue and completion result

#### Implementation of

`ICommandQueueInternal.enqueueAndWait`

---

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

Get a command by ID.

#### Parameters

##### commandId

`string`

Command ID

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

Command record or undefined

#### Implementation of

`ICommandQueueInternal.getCommand`

---

### getCommandEntities()

> **getCommandEntities**(`commandId`, `collection?`): `Promise`\<`string`[]\>

Get entity IDs that were created or updated by a command's anticipated events.

#### Parameters

##### commandId

`string`

The command ID

##### collection?

`string`

Optional collection filter

#### Returns

`Promise`\<`string`[]\>

Entity IDs, or empty if the command has no tracked entries

#### Implementation of

`ICommandQueueInternal.getCommandEntities`

---

### getEntityIdForCommand()

> **getEntityIdForCommand**(`command`): `string` \| `undefined`

Derive the primary entity ID for a command. For create commands this comes from
the aggregate chain; for mutate commands it comes from the first affected
aggregate. Returns undefined when neither path yields an ID — callers decide
whether that's fatal (`buildUpdatingContext`) or expected (reconciliation).

#### Parameters

##### command

[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>

#### Returns

`string` \| `undefined`

#### Implementation of

`ICommandQueueInternal.getEntityIdForCommand`

---

### getIdMapping()

> **getIdMapping**(`clientId`): \{ `serverId`: `string`; \} \| `undefined`

Synchronous in-memory lookup for a client→server ID mapping.
Checks the aggregate chain for a completed create command.
Used by CacheManager to detect already-settled commands during registration.

#### Parameters

##### clientId

[`EntityId`](../type-aliases/EntityId.md)

#### Returns

\{ `serverId`: `string`; \} \| `undefined`

The server ID if the client ID has been reconciled, undefined otherwise.

#### Implementation of

`ICommandQueueInternal.getIdMapping`

---

### initialize()

> **initialize**(): `Promise`\<`void`\>

Restore in-memory state from storage.

Rebuilds aggregate chains from persisted commands so AutoRevision resolution
and auto-dependency detection work from the first enqueue.
Must be awaited before the queue is resumed or any commands are enqueued.

#### Returns

`Promise`\<`void`\>

---

### isPaused()

> **isPaused**(): `boolean`

Check if command processing is paused.

#### Returns

`boolean`

#### Implementation of

`ICommandQueueInternal.isPaused`

---

### listCommands()

> **listCommands**(`filter?`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

List commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](../interfaces/CommandFilter.md)

Optional filter criteria

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Matching commands

#### Implementation of

`ICommandQueueInternal.listCommands`

---

### onCommandDeleted()

> **onCommandDeleted**(`command`): `void`

Lifecycle hook invoked by the eventual command-record deletion path.

Detaches the command from any aggregate chains that still reference it.
For non-success terminals this is a no-op (chains were already cleaned at
the terminal transition). For a deleted succeeded command it clears the
command's remaining fingerprints (most commonly `latestCommandId`) while
preserving any `lastKnownRevision` it contributed.

Safe to call with a commandId whose record no longer exists in storage.

#### Parameters

##### command

[`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`\>

#### Returns

`void`

---

### pause()

> **pause**(): `Promise`\<`void`\>

Pause command processing.
Resolves after any in-flight command finishes; callers who only want
the flag flipped can simply not await.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICommandQueueInternal.pause`

---

### processPendingCommands()

> **processPendingCommands**(): `Promise`\<`void`\>

Process pending commands.
Called by the sync manager when network is available.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICommandQueueInternal.processPendingCommands`

---

### rebuildChains()

> `protected` **rebuildChains**(): `Promise`\<`void`\>

Rebuild in-memory aggregate chains from active commands.
Called on resume so chains exist for AutoRevision resolution and
auto-dependency detection on new enqueues.

`'applied'` is intentionally excluded from the status filter: chains are
for in-flight coordination, and applied commands are fully terminal with
their server state already reflected. Stale UI references to reconciled
temp ids go through [ICommandIdMappingStore](../interfaces/ICommandIdMappingStore.md) (durable), not chains.

On a worker-recreate mid-session this rebuild also:

- Rehydrates the client↔server dual-index via mappingStore so a
  newly enqueued command whose payload has been patched to the server id
  finds the same chain as an in-flight command keyed by the client id.
- Restores `lastKnownRevision` from each succeeded command's
  `serverResponse` so AutoRevision resolves from the last confirmed
  server revision instead of falling back to the consumer-provided
  read-model rev.

#### Returns

`Promise`\<`void`\>

---

### reset()

> **reset**(): `Promise`\<`void`\>

Reset the command queue for a session change.
Pauses, clears retry timers, and waits for in-flight processing to settle.

#### Returns

`Promise`\<`void`\>

---

### resume()

> **resume**(): `Promise`\<`void`\>

Resume command processing and drain any pending commands.
Resolves after the drain completes; callers who want fire-and-forget
can simply not await.

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ICommandQueueInternal.resume`

---

### retryCommand()

> **retryCommand**(`commandId`): `Promise`\<`Result`\<`void`, [`CommandNotFoundException`](CommandNotFoundException.md) \| [`InvalidCommandStatusException`](InvalidCommandStatusException.md)\>\>

Retry a failed command.

#### Parameters

##### commandId

`string`

Command ID to retry

#### Returns

`Promise`\<`Result`\<`void`, [`CommandNotFoundException`](CommandNotFoundException.md) \| [`InvalidCommandStatusException`](InvalidCommandStatusException.md)\>\>

#### Implementation of

`ICommandQueueInternal.retryCommand`

---

### setCacheManager()

> **setCacheManager**(`cacheManager`): `void`

Set the CacheManager reference for cache key reconciliation.
Called after construction by the orchestrator to break the circular dependency.

#### Parameters

##### cacheManager

`ICacheManagerInternal`\<`TLink`\>

#### Returns

`void`

---

### waitForCompletion()

> **waitForCompletion**(`commandId`, `options?`): `Promise`\<`Result`\<`unknown`, [`CommandCompletionError`](../type-aliases/CommandCompletionError.md)\>\>

Wait for a specific command to reach a terminal state.
Returns when command succeeds, fails, or is cancelled.

For forms: await this after enqueue() to get server response/errors.

#### Parameters

##### commandId

`string`

ID of command to wait for

##### options?

[`WaitOptions`](../interfaces/WaitOptions.md)

Optional wait options (timeout)

#### Returns

`Promise`\<`Result`\<`unknown`, [`CommandCompletionError`](../type-aliases/CommandCompletionError.md)\>\>

Completion result

#### Implementation of

`ICommandQueueInternal.waitForCompletion`
