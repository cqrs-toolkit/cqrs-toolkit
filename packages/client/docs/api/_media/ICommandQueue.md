[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICommandQueue

# Interface: ICommandQueue\<TLink, TCommand\>

Command queue interface.
Provides form-friendly async patterns for command handling.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

## Properties

### events$

> `readonly` **events$**: `Observable`\<[`CommandEvent`](CommandEvent.md)\>

Observable of command events for reactive consumers.
Emits for all command status changes.

## Methods

### cancelCommand()

> **cancelCommand**(`commandId`): `Promise`\<`Result`\<`void`, [`CommandNotFoundException`](../classes/CommandNotFoundException.md) \| [`InvalidCommandStatusException`](../classes/InvalidCommandStatusException.md)\>\>

Cancel a pending command.
Cannot cancel commands that are already sending or completed.

#### Parameters

##### commandId

`string`

Command ID to cancel

#### Returns

`Promise`\<`Result`\<`void`, [`CommandNotFoundException`](../classes/CommandNotFoundException.md) \| [`InvalidCommandStatusException`](../classes/InvalidCommandStatusException.md)\>\>

---

### commandEvents$()

> **commandEvents$**(`commandId`): `Observable`\<[`CommandEvent`](CommandEvent.md)\>

Observable filtered to a specific command.
Useful for tracking a single command's lifecycle.

#### Parameters

##### commandId

`string`

Command ID to filter for

#### Returns

`Observable`\<[`CommandEvent`](CommandEvent.md)\>

Observable of events for that command

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

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)\<`string`, `AggregateEventData`\>

#### Parameters

##### params

`EnqueueParams`\<`TLink`, `TData`\>

#### Returns

`Promise`\<[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>\>

Enqueue result with validation status

---

### enqueueAndWait()

> **enqueueAndWait**\<`TData`, `TEvent`, `TResponse`\>(`params`): `Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Convenience: enqueue and wait for completion in one call.
Best for simple form submissions.

#### Type Parameters

##### TData

`TData`

##### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)\<`string`, `AggregateEventData`\>

##### TResponse

`TResponse`

#### Parameters

##### params

`EnqueueAndWaitParams`\<`TLink`, `TData`\>

#### Returns

`Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Combined enqueue and completion result

---

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

Get a command by ID.

#### Parameters

##### commandId

`string`

Command ID

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\> \| `undefined`\>

Command record or undefined

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

---

### isPaused()

> **isPaused**(): `boolean`

Check if command processing is paused.

#### Returns

`boolean`

---

### listCommands()

> **listCommands**(`filter?`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

List commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](CommandFilter.md)

Optional filter criteria

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]\>

Matching commands

---

### pause()

> **pause**(): `void`

Pause command processing.

#### Returns

`void`

---

### processPendingCommands()

> **processPendingCommands**(): `Promise`\<`void`\>

Process pending commands.
Called by the sync manager when network is available.

#### Returns

`Promise`\<`void`\>

---

### resume()

> **resume**(): `void`

Resume command processing.

#### Returns

`void`

---

### retryCommand()

> **retryCommand**(`commandId`): `Promise`\<`Result`\<`void`, [`CommandNotFoundException`](../classes/CommandNotFoundException.md) \| [`InvalidCommandStatusException`](../classes/InvalidCommandStatusException.md)\>\>

Retry a failed command.

#### Parameters

##### commandId

`string`

Command ID to retry

#### Returns

`Promise`\<`Result`\<`void`, [`CommandNotFoundException`](../classes/CommandNotFoundException.md) \| [`InvalidCommandStatusException`](../classes/InvalidCommandStatusException.md)\>\>

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

[`WaitOptions`](WaitOptions.md)

Optional wait options (timeout)

#### Returns

`Promise`\<`Result`\<`unknown`, [`CommandCompletionError`](../type-aliases/CommandCompletionError.md)\>\>

Completion result
