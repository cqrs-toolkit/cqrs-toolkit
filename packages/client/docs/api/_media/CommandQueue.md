[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandQueue

# Class: CommandQueue

Command queue implementation.

## Implements

- [`ICommandQueue`](../interfaces/ICommandQueue.md)

## Constructors

### Constructor

> **new CommandQueue**(`config`): `CommandQueue`

#### Parameters

##### config

[`CommandQueueConfig`](../interfaces/CommandQueueConfig.md)

#### Returns

`CommandQueue`

## Properties

### events$

> `readonly` **events$**: `Observable`\<[`CommandEvent`](../interfaces/CommandEvent.md)\>

Observable of command events for reactive consumers.
Emits for all command status changes.

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`events$`](../interfaces/ICommandQueue.md#events)

## Methods

### cancelCommand()

> **cancelCommand**(`commandId`): `Promise`\<`void`\>

Cancel a pending command.
Cannot cancel commands that are already sending or completed.

#### Parameters

##### commandId

`string`

Command ID to cancel

#### Returns

`Promise`\<`void`\>

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

> **enqueue**\<`TPayload`, `TEvent`\>(`command`, `options?`): `Promise`\<[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>\>

Enqueue a command with local validation.
Returns immediately with either validation errors or the queued command.

For forms: check result.ok to show validation errors immediately.

#### Type Parameters

##### TPayload

`TPayload`

##### TEvent

`TEvent`

#### Parameters

##### command

[`EnqueueCommand`](../interfaces/EnqueueCommand.md)\<`TPayload`\>

Command to enqueue

##### options?

[`EnqueueOptions`](../interfaces/EnqueueOptions.md)

Optional enqueue options

#### Returns

`Promise`\<[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>\>

Enqueue result with validation status

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`enqueue`](../interfaces/ICommandQueue.md#enqueue)

---

### enqueueAndWait()

> **enqueueAndWait**\<`TPayload`, `TEvent`, `TResponse`\>(`command`, `options?`): `Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Convenience: enqueue and wait for completion in one call.
Best for simple form submissions.

#### Type Parameters

##### TPayload

`TPayload`

##### TEvent

`TEvent`

##### TResponse

`TResponse`

#### Parameters

##### command

[`EnqueueCommand`](../interfaces/EnqueueCommand.md)\<`TPayload`\>

Command to enqueue

##### options?

[`EnqueueAndWaitOptions`](../interfaces/EnqueueAndWaitOptions.md)

Optional combined options

#### Returns

`Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Combined enqueue and completion result

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`enqueueAndWait`](../interfaces/ICommandQueue.md#enqueueandwait)

---

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\> \| `undefined`\>

Get a command by ID.

#### Parameters

##### commandId

`string`

Command ID

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\> \| `undefined`\>

Command record or undefined

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`getCommand`](../interfaces/ICommandQueue.md#getcommand)

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

> **listCommands**(`filter?`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

List commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](../interfaces/CommandFilter.md)

Optional filter criteria

#### Returns

`Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

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

> **retryCommand**(`commandId`): `Promise`\<`void`\>

Retry a failed command.

#### Parameters

##### commandId

`string`

Command ID to retry

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`retryCommand`](../interfaces/ICommandQueue.md#retrycommand)

---

### waitForCompletion()

> **waitForCompletion**(`commandId`, `options?`): `Promise`\<[`CommandCompletionResult`](../type-aliases/CommandCompletionResult.md)\>

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

`Promise`\<[`CommandCompletionResult`](../type-aliases/CommandCompletionResult.md)\>

Completion result

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`waitForCompletion`](../interfaces/ICommandQueue.md#waitforcompletion)
