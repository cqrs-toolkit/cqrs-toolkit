[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / BaseMessage

# Interface: BaseMessage

Defined in: [packages/client/src/protocol/messages.ts:11](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L11)

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

Defined in: [packages/client/src/protocol/messages.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L15)

Unique request ID for correlation

---

### type

> **type**: `string`

Defined in: [packages/client/src/protocol/messages.ts:13](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L13)

Message type identifier
