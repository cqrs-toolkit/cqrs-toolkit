[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RegisterWindowResponse

# Interface: RegisterWindowResponse

Defined in: [packages/client/src/protocol/messages.ts:69](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L69)

Window registration response.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### error?

> `optional` **error**: `string`

Defined in: [packages/client/src/protocol/messages.ts:75](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L75)

Error message if registration failed

---

### requestId

> **requestId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L15)

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### success

> **success**: `boolean`

Defined in: [packages/client/src/protocol/messages.ts:71](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L71)

---

### type

> **type**: `"register-response"`

Defined in: [packages/client/src/protocol/messages.ts:70](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L70)

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)

---

### workerInstanceId

> **workerInstanceId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:73](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L73)

Worker instance ID (for detecting restarts)
