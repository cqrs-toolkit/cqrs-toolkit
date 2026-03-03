[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../README.md) / [protocol](../README.md) / TabLockResponse

# Interface: TabLockResponse

Defined in: packages/client/src/protocol/messages.ts:138

Tab lock response.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### acquired

> **acquired**: `boolean`

Defined in: packages/client/src/protocol/messages.ts:141

Whether lock was acquired

---

### currentHolder?

> `optional` **currentHolder**: `string`

Defined in: packages/client/src/protocol/messages.ts:143

Current lock holder if not acquired

---

### requestId

> **requestId**: `string`

Defined in: packages/client/src/protocol/messages.ts:15

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### type

> **type**: `"tab-lock-response"`

Defined in: packages/client/src/protocol/messages.ts:139

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
