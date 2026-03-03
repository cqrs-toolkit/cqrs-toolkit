[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / CommandQueueConfig

# Interface: CommandQueueConfig

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:46

Command queue configuration.

## Properties

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:50

***

### defaultService?

> `optional` **defaultService**: `string`

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:52

***

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`unknown`, `unknown`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:49

***

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:48

***

### onCommandResponse()?

> `optional` **onCommandResponse**: (`command`, `response`) => `Promise`\<`void`\>

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:53

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

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:55

When true, terminal commands are retained in storage instead of being cleaned up.

***

### retryConfig?

> `optional` **retryConfig**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:51

***

### storage

> **storage**: [`IStorage`](IStorage.md)

Defined in: packages/client/src/core/command-queue/CommandQueue.ts:47
