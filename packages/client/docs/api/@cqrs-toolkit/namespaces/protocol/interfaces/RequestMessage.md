[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RequestMessage

# Interface: RequestMessage

Defined in: [packages/client/src/protocol/messages.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L21)

Request message from window to worker.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### args

> **args**: `unknown`[]

Defined in: [packages/client/src/protocol/messages.ts:26](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L26)

Method arguments

---

### method

> **method**: `string`

Defined in: [packages/client/src/protocol/messages.ts:24](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L24)

Method to invoke

---

### requestId

> **requestId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L15)

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### type

> **type**: `"request"`

Defined in: [packages/client/src/protocol/messages.ts:22](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L22)

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
