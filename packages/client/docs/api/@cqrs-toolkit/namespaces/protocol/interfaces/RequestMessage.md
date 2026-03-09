[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RequestMessage

# Interface: RequestMessage

Request message from window to worker.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### args

> **args**: `unknown`[]

Method arguments

---

### method

> **method**: `string`

Method to invoke

---

### requestId

> **requestId**: `string`

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### type

> **type**: `"request"`

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
