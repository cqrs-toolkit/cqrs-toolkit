[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / domainValidationError

# Function: domainValidationError()

> **domainValidationError**\<`TEvent`\>(`errors`): [`DomainExecutionOutcome`](../type-aliases/DomainExecutionOutcome.md)\<`TEvent`\>

Helper to create a `'validation-error'` outcome from one or more
`ValidationError` records.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### errors

[`ValidationError`](../interfaces/ValidationError.md)[]

## Returns

[`DomainExecutionOutcome`](../type-aliases/DomainExecutionOutcome.md)\<`TEvent`\>
