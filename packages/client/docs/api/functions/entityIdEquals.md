[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / entityIdEquals

# Function: entityIdEquals()

> **entityIdEquals**(`a`, `b`): `boolean`

Strict equality: same value AND same lifecycle state.

Two strings are equal if identical. Two EntityRefs are equal if they have
the same entityId and commandId. A string and an EntityRef are never equal —
they represent different lifecycle states of the same entity.

## Parameters

### a

[`EntityId`](../type-aliases/EntityId.md) | `undefined`

### b

[`EntityId`](../type-aliases/EntityId.md) | `undefined`

## Returns

`boolean`
