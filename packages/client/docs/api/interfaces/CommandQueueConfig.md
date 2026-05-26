[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandQueueConfig

# Interface: CommandQueueConfig\<TLink, TCommand, TSchema, TEvent\>

Command queue configuration.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../type-aliases/EnqueueCommand.md)

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Properties

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)\<`TLink`, `TCommand`\>

---

### defaultService?

> `optional` **defaultService**: `string`

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

---

### mapFailure?

> `optional` **mapFailure**: [`FailureMapper`](../type-aliases/FailureMapper.md)

Global pluggable mapping from [ServerErrorResponse](ServerErrorResponse.md) to
[FailureDescriptor](FailureDescriptor.md). Used when no per-command `mapFailure` on the
registration is defined for the failing command. Defaults to
`defaultProblemJsonMapper` at the construction site (`createCqrsClient`
resolves the config defaults via `resolveConfig`).

---

### onCommandResponse()?

> `optional` **onCommandResponse**: (`command`, `response`) => `Promise`\<`void`\>

#### Parameters

##### command

[`CommandRecord`](CommandRecord.md)\<`TLink`, `TCommand`\>

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
