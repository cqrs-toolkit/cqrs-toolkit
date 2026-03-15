[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandQueueConfig

# Interface: CommandQueueConfig

Command queue configuration.

## Properties

### anticipatedEventHandler

> **anticipatedEventHandler**: `IAnticipatedEventHandler`

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

---

### defaultService?

> `optional` **defaultService**: `string`

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`unknown`, `unknown`\>

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)

---

### handlerMetadata?

> `optional` **handlerMetadata**: [`ICommandHandlerMetadata`](ICommandHandlerMetadata.md)

Metadata lookup for command handler registrations (creates, revisionField).

---

### onCommandResponse()?

> `optional` **onCommandResponse**: (`command`, `response`) => `Promise`\<`void`\>

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

When true, terminal commands are retained in storage instead of being cleaned up.

---

### retryConfig?

> `optional` **retryConfig**: [`RetryConfig`](RetryConfig.md)

---

### storage

> **storage**: [`IStorage`](IStorage.md)
