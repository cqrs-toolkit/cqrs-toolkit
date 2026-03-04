[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandQueueConfig

# Interface: CommandQueueConfig

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:61

Command queue configuration.

## Properties

### anticipatedEventHandler

> **anticipatedEventHandler**: `IAnticipatedEventHandler`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:64

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:66

---

### defaultService?

> `optional` **defaultService**: `string`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:68

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`unknown`, `unknown`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:65

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:63

---

### onCommandResponse()?

> `optional` **onCommandResponse**: (`command`, `response`) => `Promise`\<`void`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:69

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

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:71

When true, terminal commands are retained in storage instead of being cleaned up.

---

### retryConfig?

> `optional` **retryConfig**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:67

---

### storage

> **storage**: [`IStorage`](IStorage.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:62
