[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RestoreHoldsRequest

# Interface: RestoreHoldsRequest

Defined in: [packages/client/src/protocol/messages.ts:99](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L99)

Hold restoration request (after worker restart).

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### cacheKeys

> **cacheKeys**: `string`[]

Defined in: [packages/client/src/protocol/messages.ts:104](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L104)

Cache keys to restore holds for

---

### requestId

> **requestId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L15)

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### type

> **type**: `"restore-holds"`

Defined in: [packages/client/src/protocol/messages.ts:100](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L100)

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)

---

### windowId

> **windowId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:102](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L102)

Window identifier
