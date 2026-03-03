[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../README.md) / [protocol](../README.md) / BaseMessage

# Interface: BaseMessage

Defined in: packages/client/src/protocol/messages.ts:11

Base message structure.

## Extended by

- [`RequestMessage`](RequestMessage.md)
- [`ResponseMessage`](ResponseMessage.md)
- [`RegisterWindowRequest`](RegisterWindowRequest.md)
- [`RegisterWindowResponse`](RegisterWindowResponse.md)
- [`RestoreHoldsRequest`](RestoreHoldsRequest.md)
- [`RestoreHoldsResponse`](RestoreHoldsResponse.md)
- [`TabLockRequest`](TabLockRequest.md)
- [`TabLockResponse`](TabLockResponse.md)

## Properties

### requestId

> **requestId**: `string`

Defined in: packages/client/src/protocol/messages.ts:15

Unique request ID for correlation

---

### type

> **type**: `string`

Defined in: packages/client/src/protocol/messages.ts:13

Message type identifier
