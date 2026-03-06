[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / isEnqueueSuccess

# Function: isEnqueueSuccess()

> **isEnqueueSuccess**\<`TEvent`\>(`result`): `result is OkResult<EnqueueSuccess<TEvent>>`

Defined in: [packages/client/src/types/commands.ts:255](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/commands.ts#L255)

Type guard for successful enqueue result.

## Type Parameters

### TEvent

`TEvent`

## Parameters

### result

[`EnqueueResult`](../type-aliases/EnqueueResult.md)\<`TEvent`\>

## Returns

`result is OkResult<EnqueueSuccess<TEvent>>`
