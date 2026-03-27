[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandQueueConfig

# Interface: CommandQueueConfig\<TLink, TSchema, TEvent\>

Command queue configuration.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Properties

### anticipatedEventHandler

> **anticipatedEventHandler**: `IAnticipatedEventHandler`

---

### commandIdMappingTtl?

> `optional` **commandIdMappingTtl**: `number`

TTL for command ID mappings in milliseconds. Default: 5 minutes.

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)\<`TLink`\>

---

### defaultService?

> `optional` **defaultService**: `string`

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`unknown`\>

---

### eventBus

> **eventBus**: [`EventBus`](../classes/EventBus.md)\<`TLink`\>

---

### handlerMetadata?

> `optional` **handlerMetadata**: [`ICommandHandlerMetadata`](ICommandHandlerMetadata.md)\<`TLink`, `TSchema`, `TEvent`\>

Metadata lookup for command handler registrations (creates config).

---

### onCommandResponse()?

> `optional` **onCommandResponse**: (`command`, `response`) => `Promise`\<`void`\>

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)\<`TLink`\>

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

> **storage**: [`IStorage`](IStorage.md)\<`TLink`\>
