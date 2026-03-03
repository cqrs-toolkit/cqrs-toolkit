[**@cqrs-toolkit/client**](../../../../README.md)

***

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / ResponseMessage

# Interface: ResponseMessage

Defined in: packages/client/src/protocol/messages.ts:32

Response message from worker to window.

## Extends

- [`BaseMessage`](BaseMessage.md)

## Properties

### error?

> `optional` **error**: `string`

Defined in: packages/client/src/protocol/messages.ts:39

Error message (on failure)

***

### errorCode?

> `optional` **errorCode**: `string`

Defined in: packages/client/src/protocol/messages.ts:41

Error code (on failure)

***

### requestId

> **requestId**: `string`

Defined in: packages/client/src/protocol/messages.ts:15

Unique request ID for correlation

#### Inherited from

[`BaseMessage`](BaseMessage.md).[`requestId`](BaseMessage.md#requestid)

***

### result?

> `optional` **result**: `unknown`

Defined in: packages/client/src/protocol/messages.ts:37

Result data (on success)

***

### success

> **success**: `boolean`

Defined in: packages/client/src/protocol/messages.ts:35

Whether the request succeeded

***

### type

> **type**: `"response"`

Defined in: packages/client/src/protocol/messages.ts:33

Message type identifier

#### Overrides

[`BaseMessage`](BaseMessage.md).[`type`](BaseMessage.md#type)
