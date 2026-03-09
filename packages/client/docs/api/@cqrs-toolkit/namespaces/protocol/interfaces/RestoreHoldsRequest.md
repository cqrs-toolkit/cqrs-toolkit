[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RestoreHoldsRequest

# Interface: RestoreHoldsRequest

Hold restoration request (after worker restart).

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### cacheKeys

> **cacheKeys**: `string`[]

Cache keys to restore holds for

---

### requestId

> **requestId**: `string`

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### type

> **type**: `"restore-holds"`

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)

---

### windowId

> **windowId**: `string`

Window identifier
