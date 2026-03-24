[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / createEntityId

# Function: createEntityId()

> **createEntityId**(`context`): `string`

Generate or reuse an entity ID based on handler context.

During initial execution, generates a new random UUID.
During regeneration, returns the entity ID from the original execution.

## Parameters

### context

[`HandlerContext`](../type-aliases/HandlerContext.md)

The handler context

## Returns

`string`

A stable entity ID
