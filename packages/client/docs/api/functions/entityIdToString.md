[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / entityIdToString

# Function: entityIdToString()

## Call Signature

> **entityIdToString**(`id`): `string`

Extract the plain string ID from an EntityId value.

Returns the string as-is for server-confirmed IDs, or the
embedded entityId for EntityRef values.
Passes through `undefined` when the id is absent.

### Parameters

#### id

[`EntityId`](../type-aliases/EntityId.md)

### Returns

`string`

## Call Signature

> **entityIdToString**(`id`): `string` \| `undefined`

Extract the plain string ID from an EntityId value.

Returns the string as-is for server-confirmed IDs, or the
embedded entityId for EntityRef values.
Passes through `undefined` when the id is absent.

### Parameters

#### id

[`EntityId`](../type-aliases/EntityId.md) | `undefined`

### Returns

`string` \| `undefined`
