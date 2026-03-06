[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / WorkerInstanceMessage

# Interface: WorkerInstanceMessage

Defined in: [packages/client/src/protocol/messages.ts:122](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L122)

Worker instance announcement (broadcast on connect/reconnect).

## Properties

### type

> **type**: `"worker-instance"`

Defined in: [packages/client/src/protocol/messages.ts:123](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L123)

---

### workerInstanceId

> **workerInstanceId**: `string`

Defined in: [packages/client/src/protocol/messages.ts:125](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/protocol/messages.ts#L125)

Unique worker instance ID
