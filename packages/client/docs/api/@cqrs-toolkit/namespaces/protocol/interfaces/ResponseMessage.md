[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / ResponseMessage

# Interface: ResponseMessage

Response message from worker to window.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### error?

> `optional` **error**: `string`

Error message (on failure)

---

### errorCode?

> `optional` **errorCode**: `string`

Error code (on failure)

---

### requestId

> **requestId**: `string`

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### result?

> `optional` **result**: `unknown`

Result data (on success)

---

### success

> **success**: `boolean`

Whether the request succeeded

---

### type

> **type**: `"response"`

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
