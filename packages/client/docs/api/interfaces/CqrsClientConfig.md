[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / CqrsClientConfig

# Interface: CqrsClientConfig\<TCommand, TEvent\>

Defined in: packages/client/src/types/config.ts:99

Main CQRS Client configuration.

## Type Parameters

### TCommand

`TCommand` = `unknown`

### TEvent

`TEvent` = `unknown`

## Properties

### cache?

> `optional` **cache**: [`CacheConfig`](CacheConfig.md)

Defined in: packages/client/src/types/config.ts:130

Cache configuration.

---

### collections?

> `optional` **collections**: [`CollectionConfig`](CollectionConfig.md)[]

Defined in: packages/client/src/types/config.ts:135

Collection configurations.

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/types/config.ts:141

Command sender for submitting commands to the server.
If not provided, commands are queued but not sent.

---

### debug?

> `optional` **debug**: `boolean`

Defined in: packages/client/src/types/config.ts:146

Enable debug logging.

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

Defined in: packages/client/src/types/config.ts:110

Domain executor for local command validation.
If not provided, commands are sent directly without local validation.

---

### mode?

> `optional` **mode**: [`ExecutionModeConfig`](../type-aliases/ExecutionModeConfig.md)

Defined in: packages/client/src/types/config.ts:104

Execution mode.
Defaults to 'auto': SharedWorker > Dedicated Worker > Main Thread

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Defined in: packages/client/src/types/config.ts:115

Network configuration.

---

### retry?

> `optional` **retry**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/types/config.ts:125

Retry configuration for commands.

---

### storage?

> `optional` **storage**: [`StorageConfig`](StorageConfig.md)

Defined in: packages/client/src/types/config.ts:120

Storage configuration (ignored for online-only mode).

---

### workerUrl?

> `optional` **workerUrl**: `string`

Defined in: packages/client/src/types/config.ts:152

Worker script URL (for modes B and C).
If not provided, uses default bundled worker.
