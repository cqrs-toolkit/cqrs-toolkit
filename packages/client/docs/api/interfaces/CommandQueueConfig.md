[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / CommandQueueConfig

# Interface: CommandQueueConfig

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:44

Command queue configuration.

## Properties

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:48

---

### defaultService?

> `optional` **defaultService**: `string`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:50

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`unknown`, `unknown`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:47

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:46

---

### retryConfig?

> `optional` **retryConfig**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:49

---

### storage

> **storage**: [`IStorage`](IStorage.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:45
