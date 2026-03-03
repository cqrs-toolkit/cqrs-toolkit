[**@cqrs-toolkit/client**](../../../../README.md)

***

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RegisterWindowRequest

# Interface: RegisterWindowRequest

Defined in: packages/client/src/protocol/messages.ts:58

Window registration request.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### requestId

> **requestId**: `string`

Defined in: packages/client/src/protocol/messages.ts:15

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

***

### type

> **type**: `"register"`

Defined in: packages/client/src/protocol/messages.ts:59

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)

***

### windowId

> **windowId**: `string`

Defined in: packages/client/src/protocol/messages.ts:61

Unique window identifier
