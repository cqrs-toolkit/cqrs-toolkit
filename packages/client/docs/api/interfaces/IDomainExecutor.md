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

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

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

> **handle**(`command`, `state`, `context`): [`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

Run the handler only. No validation.
Produces anticipated events from the (possibly transformed) command data.

#### Parameters

##### command

[`ExecutorCommand`](../type-aliases/ExecutorCommand.md)

The command envelope with data ready for the handler

##### state

`unknown`

##### context

[`HandlerContext`](../type-aliases/HandlerContext.md)

Execution context (phase and entity ID for regeneration)

#### Returns

[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

Success with anticipated events, or failure

---

### validate()

> **validate**(`command`, `state`): `Promise`\<`Result`\<`unknown`, [`DomainExecutionError`](../type-aliases/DomainExecutionError.md)\>\>

Run validation phases (schema, validate, validateAsync) on the command data.
Returns the validated/hydrated data on success, or a validation error.

Does NOT run the handler.

#### Parameters

##### command

[`ExecutorCommand`](../type-aliases/ExecutorCommand.md)

##### state

`unknown`

#### Returns

`Promise`\<`Result`\<`unknown`, [`DomainExecutionError`](../type-aliases/DomainExecutionError.md)\>\>
