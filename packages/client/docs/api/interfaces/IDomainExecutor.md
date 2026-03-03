[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / IDomainExecutor

# Interface: IDomainExecutor\<TCommand, TEvent\>

Defined in: packages/client/src/types/domain.ts:53

Domain executor interface - consumer implements this.
The library is agnostic to how validation is performed internally.

## Type Parameters

### TCommand

`TCommand` = `unknown`

Command type accepted by the executor

### TEvent

`TEvent` = `unknown`

Event type produced by the executor

## Methods

### execute()

> **execute**(`command`): [`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

Defined in: packages/client/src/types/domain.ts:66

Execute a command and produce anticipated events.
Validation happens here - return errors if command is invalid.

This method must be:
- Pure: no side effects
- Deterministic: same input always produces same output
- Synchronous: no async operations

#### Parameters

##### command

`TCommand`

The command to execute

#### Returns

[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

Success with anticipated events, or failure with validation errors
