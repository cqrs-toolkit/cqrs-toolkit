[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / isEnqueueFailure

# Function: isEnqueueFailure()

> **isEnqueueFailure**\<`TEvent`\>(`result`): `result is ErrResult<ValidationException<ValidationError[]>>`

Defined in: packages/client/src/types/commands.ts:264

Type guard for failed enqueue result.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### result

[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>

## Returns

`result is ErrResult<ValidationException<ValidationError[]>>`
