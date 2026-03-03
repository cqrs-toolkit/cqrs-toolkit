[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../README.md) / [protocol](../README.md) / RequestMessage

# Interface: RequestMessage

Defined in: packages/client/src/protocol/messages.ts:21

Request message from window to worker.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### args

> **args**: `unknown`[]

Defined in: packages/client/src/protocol/messages.ts:26

Method arguments

---

### method

> **method**: `string`

Defined in: packages/client/src/protocol/messages.ts:24

Method to invoke

---

### requestId

> **requestId**: `string`

Defined in: packages/client/src/protocol/messages.ts:15

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### type

> **type**: `"request"`

Defined in: packages/client/src/protocol/messages.ts:22

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
