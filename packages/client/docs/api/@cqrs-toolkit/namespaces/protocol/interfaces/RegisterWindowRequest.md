[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RegisterWindowRequest

# Interface: RegisterWindowRequest

Window registration request.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### requestId

> **requestId**: `string`

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

---

### type

> **type**: `"register"`

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)

---

### windowId

> **windowId**: `string`

Unique window identifier
