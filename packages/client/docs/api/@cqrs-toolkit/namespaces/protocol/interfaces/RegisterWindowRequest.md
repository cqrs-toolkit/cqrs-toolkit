[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RegisterWindowRequest

# Interface: RegisterWindowRequest

Defined in: [packages/client/src/protocol/messages.ts:58](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L58)

Window registration request.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### requestId

> **requestId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L15)

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### type

> **type**: `"register"`

Defined in: [packages/client/src/protocol/messages.ts:59](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L59)

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)

---

### windowId

> **windowId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:61](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L61)

Unique window identifier
