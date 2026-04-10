[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / createEntityId

# Function: createEntityId()

> **createEntityId**(`context`): [`EntityId`](../type-aliases/EntityId.md)

Generate or reuse an entity ID based on handler context.

For create commands with `idStrategy: 'temporary'`, returns an EntityRef carrying
lifecycle metadata (commandId, idStrategy). For permanent IDs or non-create commands,
returns a plain string.

During regeneration, reuses the entity ID from the original execution.

## Parameters

### context

[`HandlerContext`](../type-aliases/HandlerContext.md)

The handler context

## Returns

[`EntityId`](../type-aliases/EntityId.md)

An EntityId (EntityRef for temporary creates, string otherwise)
