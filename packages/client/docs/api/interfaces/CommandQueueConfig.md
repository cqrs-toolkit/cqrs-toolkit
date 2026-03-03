[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / CommandQueueConfig

# Interface: CommandQueueConfig

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:45

Command queue configuration.

## Properties

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:49

***

### defaultService?

> `optional` **defaultService**: `string`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:51

***

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`unknown`, `unknown`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:48

***

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:47

***

### onCommandResponse()?

> `optional` **onCommandResponse**: (`command`, `response`) => `Promise`\<`void`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:52

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)

##### response

`unknown`

#### Returns

`Promise`\<`void`\>

***

### retainTerminal?

> `optional` **retainTerminal**: `boolean`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:54

When true, terminal commands are retained in storage instead of being cleaned up.

***

### retryConfig?

> `optional` **retryConfig**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:50

***

### storage

> **storage**: [`IStorage`](IStorage.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:46
