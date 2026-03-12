[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClientConfig

# Interface: CqrsClientConfig\<TCommand, TEvent\>

Main-thread CQRS Client configuration.

Extends the shared config with main-thread-only concerns:
mode selection and worker script URL.

## Extends

- [`CqrsConfig`](CqrsConfig.md)\<`TCommand`, `TEvent`\>

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

[`CqrsConfig`](CqrsConfig.md).[`auth`](CqrsConfig.md#auth)

---

### cache?

> `optional` **cache**: [`CacheConfig`](CacheConfig.md)

Cache configuration.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`cache`](CqrsConfig.md#cache)

---

### collections?

> `optional` **collections**: [`Collection`](Collection.md)[]

Collection configurations.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`collections`](CqrsConfig.md#collections)

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Command sender for submitting commands to the server.
If not provided, commands are queued but not sent.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`commandSender`](CqrsConfig.md#commandsender)

---

### debug?

> `optional` **debug**: `boolean`

Enable debug logging.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`debug`](CqrsConfig.md#debug)

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

Domain executor for local command validation.
If not provided, commands are sent directly without local validation.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`domainExecutor`](CqrsConfig.md#domainexecutor)

---

### mode?

> `optional` **mode**: [`ExecutionModeConfig`](../type-aliases/ExecutionModeConfig.md)

Execution mode.
Defaults to 'auto': SharedWorker > Dedicated Worker > Online-only

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Network configuration.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`network`](CqrsConfig.md#network)

---

### processors?

> `optional` **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `Record`\<`string`, `unknown`\>\>[]

Event processors to register.
Processors transform domain events into read model updates.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`processors`](CqrsConfig.md#processors)

---

### retainTerminal?

> `optional` **retainTerminal**: `boolean`

Retain terminal commands in storage for debugging/introspection.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`retainTerminal`](CqrsConfig.md#retainterminal)

---

### retry?

> `optional` **retry**: [`RetryConfig`](RetryConfig.md)

Retry configuration for commands.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`retry`](CqrsConfig.md#retry)

---

### sqliteWorkerUrl?

> `optional` **sqliteWorkerUrl**: `string`

Per-tab SQLite DedicatedWorker URL for Mode C.
Each tab spawns a DedicatedWorker at this URL for SQLite I/O
(OPFS `createSyncAccessHandle` requires a DedicatedWorker context).

Required for shared-worker mode. Must be resolved on the main thread
where the bundler can process asset URL imports (e.g., Vite's
`?worker&url` suffix).

---

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Storage configuration.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`storage`](CqrsConfig.md#storage)

---

### workerSetup?

> `optional` **workerSetup**: `string`[]

Module URLs to dynamically import before initialization.
Use this to run setup code (e.g., logger bootstrap) inside the worker
before storage initialization.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`workerSetup`](CqrsConfig.md#workersetup)

---

### workerUrl?

> `optional` **workerUrl**: `string`

SharedWorker script URL (Mode C) or DedicatedWorker script URL (Mode B).
Points to the consumer's worker entry point that calls
startDedicatedWorker() or startSharedWorker().
