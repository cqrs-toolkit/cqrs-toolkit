[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RestoreHoldsResponse

# Interface: RestoreHoldsResponse

Defined in: [packages/client/src/protocol/messages.ts:108](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L108)

Hold restoration response.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### failedKeys

> **failedKeys**: `string`[]

Defined in: [packages/client/src/protocol/messages.ts:114](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L114)

Keys that failed to restore (no longer exist)

---

### requestId

> **requestId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L15)

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### restoredKeys

> **restoredKeys**: `string`[]

Defined in: [packages/client/src/protocol/messages.ts:112](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L112)

Keys that were successfully restored

---

### success

> **success**: `boolean`

Defined in: [packages/client/src/protocol/messages.ts:110](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L110)

---

### type

> **type**: `"restore-holds-response"`

Defined in: [packages/client/src/protocol/messages.ts:109](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L109)

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
