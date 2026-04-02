[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / isDomainFailure

# Function: isDomainFailure()

> **isDomainFailure**\<`TEvent`\>(`result`): `result is ErrResult<DomainExecutionError>`

Type guard for failed domain execution.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### result

[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

## Returns

`result is ErrResult<DomainExecutionError>`
