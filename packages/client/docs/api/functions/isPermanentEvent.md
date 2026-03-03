[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / isPermanentEvent

# Function: isPermanentEvent()

> **isPermanentEvent**\<`T`\>(`event`): `event is ServerEvent<T> & PermanentEventMeta`

Defined in: packages/client/src/types/events.ts:142

Type guard for permanent events.

## Type Parameters

### T

`T`

## Parameters

### event

[`AnyEvent`](../type-aliases/AnyEvent.md)\<`T`\>

## Returns

`event is ServerEvent<T> & PermanentEventMeta`
