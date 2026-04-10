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

> **new CommandQueue**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`storage`, `eventBus`, `fileStore`, `anticipatedEventHandler`, `config?`): `CommandQueue`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

#### Parameters

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### fileStore

`ICommandFileStore`

File store for commands with file attachments.

##### anticipatedEventHandler

`IAnticipatedEventHandler`

##### config?

[`CommandQueueConfig`](../interfaces/CommandQueueConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\> = `{}`

#### Returns

`CommandQueue`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

## Properties

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

### pause()

> **pause**(): `void`

Pause command processing.

#### Returns

`void`

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

### reset()

> **reset**(): `Promise`\<`void`\>

Reset the command queue for a session change.
Pauses, clears retry timers, and waits for in-flight processing to settle.

#### Returns

`Promise`\<`void`\>

---

### resume()

> **resume**(): `void`

Resume command processing.

#### Returns

`void`

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
