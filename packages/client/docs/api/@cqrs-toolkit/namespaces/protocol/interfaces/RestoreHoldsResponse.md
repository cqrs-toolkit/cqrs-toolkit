[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RestoreHoldsResponse

# Interface: RestoreHoldsResponse

Defined in: [packages/client/src/protocol/messages.ts:110](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L110)

Hold restoration response.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### failedKeys

> **failedKeys**: `string`[]

Defined in: [packages/client/src/protocol/messages.ts:116](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L116)

Keys that failed to restore (no longer exist)

---

### requestId

> **requestId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L15)

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### restoredKeys

> **restoredKeys**: `string`[]

Defined in: [packages/client/src/protocol/messages.ts:114](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L114)

Keys that were successfully restored

---

### success

> **success**: `boolean`

Defined in: [packages/client/src/protocol/messages.ts:112](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L112)

---

### type

> **type**: `"restore-holds-response"`

Defined in: [packages/client/src/protocol/messages.ts:111](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L111)

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
