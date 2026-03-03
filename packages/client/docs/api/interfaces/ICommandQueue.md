[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / ICommandQueue

# Interface: ICommandQueue

Defined in: packages/client/src/core/command-queue/types.ts:23

Command queue interface.
Provides form-friendly async patterns for command handling.

## Properties

### events$

> `readonly` **events$**: `Observable`\<[`CommandEvent`](CommandEvent.md)\>

Defined in: packages/client/src/core/command-queue/types.ts:68

Observable of command events for reactive consumers.
Emits for all command status changes.

## Methods

### cancelCommand()

> **cancelCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/core/command-queue/types.ts:101

Cancel a pending command.
Cannot cancel commands that are already sending or completed.

#### Parameters

##### commandId

`string`

Command ID to cancel

#### Returns

`Promise`\<`void`\>

---

### commandEvents$()

> **commandEvents$**(`commandId`): `Observable`\<[`CommandEvent`](CommandEvent.md)\>

Defined in: packages/client/src/core/command-queue/types.ts:77

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

> **enqueue**\<`TPayload`, `TEvent`\>(`command`, `options?`): `Promise`\<[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>\>

Defined in: packages/client/src/core/command-queue/types.ts:34

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

[`EnqueueCommand`](EnqueueCommand.md)\<`TPayload`\>

Command to enqueue

##### options?

[`EnqueueOptions`](EnqueueOptions.md)

Optional enqueue options

#### Returns

`Promise`\<[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>\>

Enqueue result with validation status

---

### enqueueAndWait()

> **enqueueAndWait**\<`TPayload`, `TEvent`, `TResponse`\>(`command`, `options?`): `Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Defined in: packages/client/src/core/command-queue/types.ts:59

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

[`EnqueueCommand`](EnqueueCommand.md)\<`TPayload`\>

Command to enqueue

##### options?

[`EnqueueAndWaitOptions`](EnqueueAndWaitOptions.md)

Optional combined options

#### Returns

`Promise`\<[`EnqueueAndWaitResult`](../type-aliases/EnqueueAndWaitResult.md)\<`TResponse`\>\>

Combined enqueue and completion result

---

### getCommand()

> **getCommand**(`commandId`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\> \| `null`\>

Defined in: packages/client/src/core/command-queue/types.ts:85

Get a command by ID.

#### Parameters

##### commandId

`string`

Command ID

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\> \| `null`\>

Command record or null

---

### isPaused()

> **isPaused**(): `boolean`

Defined in: packages/client/src/core/command-queue/types.ts:129

Check if command processing is paused.

#### Returns

`boolean`

---

### listCommands()

> **listCommands**(`filter?`): `Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Defined in: packages/client/src/core/command-queue/types.ts:93

List commands matching a filter.

#### Parameters

##### filter?

[`CommandFilter`](CommandFilter.md)

Optional filter criteria

#### Returns

`Promise`\<[`CommandRecord`](CommandRecord.md)\<`unknown`, `unknown`\>[]\>

Matching commands

---

### pause()

> **pause**(): `void`

Defined in: packages/client/src/core/command-queue/types.ts:119

Pause command processing.

#### Returns

`void`

---

### processPendingCommands()

> **processPendingCommands**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/command-queue/types.ts:114

Process pending commands.
Called by the sync manager when network is available.

#### Returns

`Promise`\<`void`\>

---

### resume()

> **resume**(): `void`

Defined in: packages/client/src/core/command-queue/types.ts:124

Resume command processing.

#### Returns

`void`

---

### retryCommand()

> **retryCommand**(`commandId`): `Promise`\<`void`\>

Defined in: packages/client/src/core/command-queue/types.ts:108

Retry a failed command.

#### Parameters

##### commandId

`string`

Command ID to retry

#### Returns

`Promise`\<`void`\>

---

### waitForCompletion()

> **waitForCompletion**(`commandId`, `options?`): `Promise`\<[`CommandCompletionResult`](../type-aliases/CommandCompletionResult.md)\>

Defined in: packages/client/src/core/command-queue/types.ts:49

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

`Promise`\<[`CommandCompletionResult`](../type-aliases/CommandCompletionResult.md)\>

Completion result
