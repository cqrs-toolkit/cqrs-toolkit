[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / BaseMessage

# Interface: BaseMessage

Base message structure.

## Extended by

- [`RequestMessage`](RequestMessage.md)
- [`ResponseMessage`](ResponseMessage.md)
- [`RegisterWindowRequest`](RegisterWindowRequest.md)
- [`RegisterWindowResponse`](RegisterWindowResponse.md)
- [`RestoreHoldsRequest`](RestoreHoldsRequest.md)
- [`RestoreHoldsResponse`](RestoreHoldsResponse.md)

## Properties

### requestId

> **requestId**: `string`

Unique request ID for correlation

---

### type

> **type**: `string`

Message type identifier
