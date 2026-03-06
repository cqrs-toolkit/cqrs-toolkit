[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerInstanceMessage

# Interface: WorkerInstanceMessage

Defined in: [packages/client/src/protocol/messages.ts:120](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L120)

Worker instance announcement (broadcast on connect/reconnect).

## Properties

### type

> **type**: `"worker-instance"`

Defined in: [packages/client/src/protocol/messages.ts:121](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L121)

---

### workerInstanceId

> **workerInstanceId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:123](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/protocol/messages.ts#L123)

Unique worker instance ID
