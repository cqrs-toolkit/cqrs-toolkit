[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / isDomainSuccess

# Function: isDomainSuccess()

> **isDomainSuccess**\<`TEvent`\>(`result`): `result is OkResult<DomainExecutionSuccess<TEvent>>`

Defined in: [packages/client/src/types/domain.ts:73](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/domain.ts#L73)

Type guard for successful domain execution.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### result

[`DomainExecutionResult`](../type-aliases/DomainExecutionResult.md)\<`TEvent`\>

## Returns

`result is OkResult<DomainExecutionSuccess<TEvent>>`
