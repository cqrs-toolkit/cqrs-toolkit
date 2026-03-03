[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / ResolvedConfig

# Interface: ResolvedConfig\<TCommand, TEvent\>

Defined in: packages/client/src/types/config.ts:183

Resolved configuration with all defaults applied.

## Extends

- `Required`\<`Omit`\<[`CqrsClientConfig`](CqrsClientConfig.md)\<`TCommand`, `TEvent`\>, `"domainExecutor"` \| `"commandSender"` \| `"workerUrl"` \| `"collections"`\>\>

## Extended by

- [`DedicatedWorkerAdapterConfig`](DedicatedWorkerAdapterConfig.md)
- [`SharedWorkerAdapterConfig`](SharedWorkerAdapterConfig.md)

## Type Parameters

### TCommand

`TCommand` = `unknown`

### TEvent

`TEvent` = `unknown`

## Properties

### cache

> **cache**: [`CacheConfig`](CacheConfig.md)

Defined in: packages/client/src/types/config.ts:130

Cache configuration.

#### Inherited from

`Required.cache`

---

### collections

> **collections**: [`CollectionConfig`](CollectionConfig.md)[]

Defined in: packages/client/src/types/config.ts:192

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/types/config.ts:190

---

### debug

> **debug**: `boolean`

Defined in: packages/client/src/types/config.ts:146

Enable debug logging.

#### Inherited from

`Required.debug`

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

Defined in: packages/client/src/types/config.ts:189

---

### mode

> **mode**: [`ExecutionModeConfig`](../type-aliases/ExecutionModeConfig.md)

Defined in: packages/client/src/types/config.ts:104

Execution mode.
Defaults to 'auto': SharedWorker > Dedicated Worker > Main Thread

#### Inherited from

`Required.mode`

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Defined in: packages/client/src/types/config.ts:115

Network configuration.

#### Inherited from

`Required.network`

---

### retry

> **retry**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/types/config.ts:125

Retry configuration for commands.

#### Inherited from

`Required.retry`

---

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Defined in: packages/client/src/types/config.ts:120

Storage configuration (ignored for online-only mode).

#### Inherited from

`Required.storage`

---

### workerUrl?

> `optional` **workerUrl**: `string`

Defined in: packages/client/src/types/config.ts:191
