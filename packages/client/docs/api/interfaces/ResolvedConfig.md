[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ResolvedConfig

# Interface: ResolvedConfig\<TCommand, TEvent\>

Defined in: packages/client/src/types/config.ts:319

Resolved shared configuration with all defaults applied.

## Extends

- `Required`\<`Omit`\<[`CqrsConfig`](CqrsConfig.md)\<`TCommand`, `TEvent`\>, `"domainExecutor"` \| `"commandSender"` \| `"workerSetup"` \| `"collections"` \| `"processors"`\>\>

## Type Parameters

### TCommand

`TCommand` = `unknown`

### TEvent

`TEvent` = `unknown`

## Properties

### cache

> **cache**: [`CacheConfig`](CacheConfig.md)

Defined in: packages/client/src/types/config.ts:217

Cache configuration.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`cache`](CqrsClientConfig.md#cache)

---

### collections

> **collections**: [`Collection`](Collection.md)[]

Defined in: packages/client/src/types/config.ts:328

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/types/config.ts:326

---

### debug

> **debug**: `boolean`

Defined in: packages/client/src/types/config.ts:244

Enable debug logging.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`debug`](CqrsClientConfig.md#debug)

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

Defined in: packages/client/src/types/config.ts:325

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Defined in: packages/client/src/types/config.ts:202

Network configuration.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`network`](CqrsClientConfig.md#network)

---

### processors

> **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `Record`\<`string`, `unknown`\>\>[]

Defined in: packages/client/src/types/config.ts:329

---

### retainTerminal

> **retainTerminal**: `boolean`

Defined in: packages/client/src/types/config.ts:239

Retain terminal commands in storage for debugging/introspection.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`retainTerminal`](CqrsClientConfig.md#retainterminal)

---

### retry

> **retry**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/types/config.ts:212

Retry configuration for commands.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`retry`](CqrsClientConfig.md#retry)

---

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Defined in: packages/client/src/types/config.ts:207

Storage configuration (ignored for online-only mode).

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`storage`](CqrsClientConfig.md#storage)

---

### workerSetup?

> `optional` **workerSetup**: `string`[]

Defined in: packages/client/src/types/config.ts:327
