[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../README.md) / [protocol](../README.md) / RestoreHoldsResponse

# Interface: RestoreHoldsResponse

Defined in: packages/client/src/protocol/messages.ts:108

Hold restoration response.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### failedKeys

> **failedKeys**: `string`[]

Defined in: packages/client/src/protocol/messages.ts:114

Keys that failed to restore (no longer exist)

---

### requestId

> **requestId**: `string`

Defined in: packages/client/src/protocol/messages.ts:15

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### restoredKeys

> **restoredKeys**: `string`[]

Defined in: packages/client/src/protocol/messages.ts:112

Keys that were successfully restored

---

### success

> **success**: `boolean`

Defined in: packages/client/src/protocol/messages.ts:110

---

### type

> **type**: `"restore-holds-response"`

Defined in: packages/client/src/protocol/messages.ts:109

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
