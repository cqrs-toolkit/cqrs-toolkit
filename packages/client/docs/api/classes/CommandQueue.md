[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandQueue

# Class: CommandQueue\<TLink, TCommand, TSchema, TEvent\>

Command queue interface.
Provides form-friendly async patterns for command handling.

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

- [`ICommandQueue`](../interfaces/ICommandQueue.md)\<`TLink`, `TCommand`\>

## Constructors

### Constructor

> **new CommandQueue**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`config`): `CommandQueue`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

#### Parameters

##### config

[`CommandQueueConfig`](../interfaces/CommandQueueConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

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

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`events$`](../interfaces/ICommandQueue.md#events)

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

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`cancelCommand`](../interfaces/ICommandQueue.md#cancelcommand)

---

### clearAll()

> **clearAll**(): `Promise`\<`void`\>

Clear all command state for session destroy.
Pauses, clears retry timers, waits for in-flight, clears anticipated event tracking, deletes all commands.

#### Returns

`Promise`\<`void`\>

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

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`commandEvents$`](../interfaces/ICommandQueue.md#commandevents)

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Destroy the command queue and release resources.
Waits for any in-flight command processing to settle before returning.

#### Returns

`Promise`\<`void`\>

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

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AggregateEventData`\>

#### Parameters

##### params

`EnqueueParams`\<`TLink`, `TData`\>

#### Returns

`Promise`\<[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>\>

Enqueue result with validation status

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`enqueue`](../interfaces/ICommandQueue.md#enqueue)

---

### enqueueAndWait()

> **enqueueAndWait**\<`TData`, `TEvent`, `TResponse`\>(`params`): `Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Convenience: enqueue and wait for completion in one call.
Best for simple form submissions.

#### Type Parameters

##### TData

`TData`

##### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AggregateEventData`\>

##### TResponse

`TResponse`

#### Parameters

##### params

`EnqueueAndWaitParams`\<`TLink`, `TData`\>

#### Returns

`Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Combined enqueue and completion result

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`enqueueAndWait`](../interfaces/ICommandQueue.md#enqueueandwait)

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

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`getCommand`](../interfaces/ICommandQueue.md#getcommand)

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

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`getCommandEntities`](../interfaces/ICommandQueue.md#getcommandentities)

---

### isPaused()

> **isPaused**(): `boolean`

Check if command processing is paused.

#### Returns

`boolean`

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`isPaused`](../interfaces/ICommandQueue.md#ispaused)

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

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`listCommands`](../interfaces/ICommandQueue.md#listcommands)

---

### pause()

> **pause**(): `void`

Pause command processing.

#### Returns

`void`

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`pause`](../interfaces/ICommandQueue.md#pause)

---

### processPendingCommands()

> **processPendingCommands**(): `Promise`\<`void`\>

Process pending commands.
Called by the sync manager when network is available.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`processPendingCommands`](../interfaces/ICommandQueue.md#processpendingcommands)

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

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`resume`](../interfaces/ICommandQueue.md#resume)

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

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`retryCommand`](../interfaces/ICommandQueue.md#retrycommand)

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

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`waitForCompletion`](../interfaces/ICommandQueue.md#waitforcompletion)
