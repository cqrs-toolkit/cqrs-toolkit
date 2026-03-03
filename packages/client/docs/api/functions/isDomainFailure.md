[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / isDomainFailure

# Function: isDomainFailure()

> **isDomainFailure**\<`TEvent`\>(`result`): `result is DomainExecutionFailure`

Defined in: packages/client/src/types/domain.ts:81

Type guard for failed domain execution.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### result

[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

## Returns

`result is DomainExecutionFailure`
