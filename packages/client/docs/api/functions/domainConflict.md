[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / domainConflict

# Function: domainConflict()

> **domainConflict**\<`TEvent`\>(`args`): [`DomainExecutionOutcome`](../type-aliases/DomainExecutionOutcome.md)\<`TEvent`\>

Helper to create a `'conflict'` outcome carrying a [FailureCategory](../type-aliases/FailureCategory.md).

Use when the handler detects (via `{ initial, current }`) that the command
cannot proceed cleanly against the current state — a server change rendered
the user's edit invalid, the user's intent is already satisfied, etc.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### args

#### category

[`FailureCategory`](../type-aliases/FailureCategory.md)

#### details?

`unknown`

#### errorCode?

`string`

#### message

`string`

## Returns

[`DomainExecutionOutcome`](../type-aliases/DomainExecutionOutcome.md)\<`TEvent`\>
