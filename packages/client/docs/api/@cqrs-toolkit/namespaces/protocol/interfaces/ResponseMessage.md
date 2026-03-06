[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / ResponseMessage

# Interface: ResponseMessage

Defined in: [packages/client/src/protocol/messages.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L32)

Response message from worker to window.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### error?

> `optional` **error**: `string`

Defined in: [packages/client/src/protocol/messages.ts:39](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L39)

Error message (on failure)

---

### errorCode?

> `optional` **errorCode**: `string`

Defined in: [packages/client/src/protocol/messages.ts:41](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L41)

Error code (on failure)

---

### requestId

> **requestId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L15)

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### result?

> `optional` **result**: `unknown`

Defined in: [packages/client/src/protocol/messages.ts:37](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L37)

Result data (on success)

---

### success

> **success**: `boolean`

Defined in: [packages/client/src/protocol/messages.ts:35](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L35)

Whether the request succeeded

---

### type

> **type**: `"response"`

Defined in: [packages/client/src/protocol/messages.ts:33](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L33)

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
