[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / isDomainFailure

# Function: isDomainFailure()

> **isDomainFailure**\<`TEvent`\>(`result`): `result is ErrResult<ValidationException<ValidationError[]>>`

Defined in: [packages/client/src/types/domain.ts:82](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/domain.ts#L82)

Type guard for failed domain execution.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### result

[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

## Returns

`result is ErrResult<ValidationException<ValidationError[]>>`
