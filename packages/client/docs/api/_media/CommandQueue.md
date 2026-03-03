[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / CommandQueue

# Class: CommandQueue

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:66

Command queue implementation.

## Implements

- [`ICommandQueue`](../interfaces/ICommandQueue.md)

## Constructors

### Constructor

> **new CommandQueue**(`config`): `CommandQueue`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:87

#### Parameters

##### config

[`CommandQueueConfig`](../interfaces/CommandQueueConfig.md)

#### Returns

`CommandQueue`

## Properties

### events$

> `readonly` **events$**: `Observable`\<[`CommandEvent`](../interfaces/CommandEvent.md)\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:85

Observable of command events for reactive consumers.
Emits for all command status changes.

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`events$`](../interfaces/ICommandQueue.md#events)

## Methods

### cancelCommand()

> **cancelCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:256

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

***

### commandEvents$()

> **commandEvents$**(`commandId`): `Observable`\<[`CommandEvent`](../interfaces/CommandEvent.md)\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:244

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

***

### destroy()

> **destroy**(): `void`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:583

Destroy the command queue and release resources.

#### Returns

`void`

***

### enqueue()

> **enqueue**\<`TPayload`, `TEvent`\>(`command`, `options?`): `Promise`\<[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:100

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

***

### enqueueAndWait()

> **enqueueAndWait**\<`TPayload`, `TEvent`, `TResponse`\>(`command`, `options?`): `Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:205

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

***

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\> \| `undefined`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:248

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

***

### isPaused()

> **isPaused**(): `boolean`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:576

Check if command processing is paused.

#### Returns

`boolean`

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`isPaused`](../interfaces/ICommandQueue.md#ispaused)

***

### listCommands()

> **listCommands**(`filter?`): `Promise`\<[`CommandRecord`](../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:252

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

***

### pause()

> **pause**(): `void`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:562

Pause command processing.

#### Returns

`void`

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`pause`](../interfaces/ICommandQueue.md#pause)

***

### processPendingCommands()

> **processPendingCommands**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:286

Process pending commands.
Called by the sync manager when network is available.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`processPendingCommands`](../interfaces/ICommandQueue.md#processpendingcommands)

***

### resume()

> **resume**(): `void`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:567

Resume command processing.

#### Returns

`void`

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`resume`](../interfaces/ICommandQueue.md#resume)

***

### retryCommand()

> **retryCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:273

Retry a failed command.

#### Parameters

##### commandId

`string`

Command ID to retry

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICommandQueue`](../interfaces/ICommandQueue.md).[`retryCommand`](../interfaces/ICommandQueue.md#retrycommand)

***

### waitForCompletion()

> **waitForCompletion**(`commandId`, `options?`): `Promise`\<[`CommandCompletionResult`](../type-aliases/CommandCompletionResult.md)\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:176

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
