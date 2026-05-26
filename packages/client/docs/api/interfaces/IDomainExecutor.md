[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IDomainExecutor

# Interface: IDomainExecutor\<TLink, TCommand, TSchema, TEvent\>

Domain executor interface.

Provides separate validation and handler phases so the CommandQueue can
transform data between them (e.g., re-injecting EntityRef values after
validation but before the handler runs).

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../type-aliases/EnqueueCommand.md)

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)

Event type produced by the executor

## Methods

### getRegistration()

> **getRegistration**(`commandType`): [`CommandHandlerRegistration`](../type-aliases/CommandHandlerRegistration.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\> \| `undefined`

#### Parameters

##### commandType

`string`

#### Returns

[`CommandHandlerRegistration`](../type-aliases/CommandHandlerRegistration.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\> \| `undefined`

---

### handle()

> **handle**(`command`, `state`, `context`): [`DomainExecutionOutcome`](../type-aliases/DomainExecutionOutcome.md)\<`TEvent`\>

Run the handler only. No validation.
Produces anticipated events, a conflict signal, or an executor-level
error from the (possibly transformed) command data.

#### Parameters

##### command

[`ExecutorCommand`](../type-aliases/ExecutorCommand.md)

The command envelope with data ready for the handler

##### state

[`HandlerState`](../type-aliases/HandlerState.md)

[HandlerState](../type-aliases/HandlerState.md) carrying `initial` (submit-time snapshot)
and `current` (post-server-event view on regenerate)

##### context

[`HandlerContext`](../type-aliases/HandlerContext.md)

Execution context (phase and entity ID for regeneration)

#### Returns

[`DomainExecutionOutcome`](../type-aliases/DomainExecutionOutcome.md)\<`TEvent`\>

A [DomainExecutionOutcome](../type-aliases/DomainExecutionOutcome.md) discriminated on `kind`.

---

### validate()

> **validate**(`command`, `state`): `Promise`\<`Result`\<`unknown`, [`ValidationException`](../classes/ValidationException.md) \| [`UnknownCommandException`](../classes/UnknownCommandException.md) \| [`ConflictException`](../classes/ConflictException.md)\>\>

Run validation phases (schema, validate, validateAsync) on the command data.
Returns the validated/hydrated data on success, or a validation error.

Does NOT run the handler. Validation is binary (succeeded with hydrated
data, or failed); the algebraic outcome shape only applies at the handler
boundary where 3+ outcomes are legitimately distinct.

#### Parameters

##### command

[`ExecutorCommand`](../type-aliases/ExecutorCommand.md)

##### state

[`HandlerState`](../type-aliases/HandlerState.md)

#### Returns

`Promise`\<`Result`\<`unknown`, [`ValidationException`](../classes/ValidationException.md) \| [`UnknownCommandException`](../classes/UnknownCommandException.md) \| [`ConflictException`](../classes/ConflictException.md)\>\>
