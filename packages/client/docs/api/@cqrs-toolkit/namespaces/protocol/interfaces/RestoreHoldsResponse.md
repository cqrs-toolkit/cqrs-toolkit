[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RestoreHoldsResponse

# Interface: RestoreHoldsResponse

Hold restoration response.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### failedKeys

> **failedKeys**: `string`[]

Keys that failed to restore (no longer exist)

---

### requestId

> **requestId**: `string`

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### restoredKeys

> **restoredKeys**: `string`[]

Keys that were successfully restored

---

### success

> **success**: `boolean`

---

### type

> **type**: `"restore-holds-response"`

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
