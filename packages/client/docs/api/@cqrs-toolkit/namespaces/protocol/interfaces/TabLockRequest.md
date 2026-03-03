[**@cqrs-toolkit/client**](../../../../README.md)

***

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / TabLockRequest

# Interface: TabLockRequest

Defined in: packages/client/src/protocol/messages.ts:129

Tab lock request (for single-tab modes).

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

### tabId

> **tabId**: `string`

Defined in: packages/client/src/protocol/messages.ts:132

Tab/window identifier

***

### type

> **type**: `"tab-lock"`

Defined in: packages/client/src/protocol/messages.ts:130

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
