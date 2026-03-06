[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandQueueConfig

# Interface: CommandQueueConfig

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:61](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L61)

Command queue configuration.

## Properties

### anticipatedEventHandler

> **anticipatedEventHandler**: `IAnticipatedEventHandler`

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:64](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L64)

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:66](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L66)

---

### defaultService?

> `optional` **defaultService**: `string`

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:68](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L68)

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`unknown`, `unknown`\>

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:65](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L65)

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:63](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L63)

---

### onCommandResponse()?

> `optional` **onCommandResponse**: (`command`, `response`) => `Promise`\<`void`\>

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:69](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L69)

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)

##### response

`unknown`

#### Returns

`Promise`\<`void`\>

---

### retainTerminal?

> `optional` **retainTerminal**: `boolean`

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:71](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L71)

When true, terminal commands are retained in storage instead of being cleaned up.

---

### retryConfig?

> `optional` **retryConfig**: [`RetryConfig`](RetryConfig.md)

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:67](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L67)

---

### storage

> **storage**: [`IStorage`](IStorage.md)

Defined in: [packages/client/src/core/command-queue/CommandQueue.ts:62](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/command-queue/CommandQueue.ts#L62)
