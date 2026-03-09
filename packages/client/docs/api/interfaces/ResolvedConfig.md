[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ResolvedConfig

# Interface: ResolvedConfig\<TCommand, TEvent\>

Resolved shared configuration with all defaults applied.

## Extends

- `Required`\<`Omit`\<[`CqrsConfig`](CqrsConfig.md)\<`TCommand`, `TEvent`\>, `"domainExecutor"` \| `"commandSender"` \| `"workerSetup"` \| `"collections"` \| `"processors"`\>\>

## Type Parameters

### TCommand

`TCommand` = `unknown`

### TEvent

`TEvent` = `unknown`

## Properties

### auth

> **auth**: [`AuthStrategy`](AuthStrategy.md)

Auth strategy for transport-level authentication.
Controls how HTTP requests and WebSocket connections are authenticated.
Use `cookieAuthStrategy` for cookie-based auth (all hooks are noop).

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`auth`](CqrsClientConfig.md#auth)

---

### cache

> **cache**: [`CacheConfig`](CacheConfig.md)

Cache configuration.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`cache`](CqrsClientConfig.md#cache)

---

### collections

> **collections**: [`Collection`](Collection.md)[]

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

---

### debug

> **debug**: `boolean`

Enable debug logging.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`debug`](CqrsClientConfig.md#debug)

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Network configuration.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`network`](CqrsClientConfig.md#network)

---

### processors

> **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `Record`\<`string`, `unknown`\>\>[]

---

### retainTerminal

> **retainTerminal**: `boolean`

Retain terminal commands in storage for debugging/introspection.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`retainTerminal`](CqrsClientConfig.md#retainterminal)

---

### retry

> **retry**: [`RetryConfig`](RetryConfig.md)

Retry configuration for commands.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`retry`](CqrsClientConfig.md#retry)

---

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Storage configuration (ignored for online-only mode).

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`storage`](CqrsClientConfig.md#storage)

---

### workerSetup?

> `optional` **workerSetup**: `string`[]
