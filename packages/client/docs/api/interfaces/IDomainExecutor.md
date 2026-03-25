[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IDomainExecutor

# Interface: IDomainExecutor\<TEvent\>

Domain executor interface - consumer implements this.
The library is agnostic to how validation is performed internally.

## Type Parameters

### TEvent

`TEvent` = `unknown`

Event type produced by the executor

## Methods

### execute()

> **execute**(`command`, `context`): `Promise`\<[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>\>

Execute a command through the validation pipeline and produce anticipated events.

On initial execution (`'initializing'`), runs all validation phases
(schema, validate, validateAsync) before the handler.
On regeneration (`'updating'`), skips validation and runs the handler directly.

#### Parameters

##### command

[`ExecutorCommand`](ExecutorCommand.md)

The command envelope to execute

##### context

[`HandlerContext`](../type-aliases/HandlerContext.md)

Execution context (phase and entity ID for regeneration)

#### Returns

`Promise`\<[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>\>

Success with anticipated events, or failure with validation errors
