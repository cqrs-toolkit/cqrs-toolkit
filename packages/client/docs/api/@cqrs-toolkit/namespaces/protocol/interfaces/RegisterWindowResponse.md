[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RegisterWindowResponse

# Interface: RegisterWindowResponse

Window registration response.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### error?

> `optional` **error**: `string`

Error message if registration failed

---

### requestId

> **requestId**: `string`

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### success

> **success**: `boolean`

---

### type

> **type**: `"register-response"`

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)

---

### workerInstanceId

> **workerInstanceId**: `string`

Worker instance ID (for detecting restarts)
