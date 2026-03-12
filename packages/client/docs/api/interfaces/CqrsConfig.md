[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsConfig

# Interface: CqrsConfig\<TCommand, TEvent\>

Shared CQRS configuration.

Contains all domain-level settings shared between the main thread and worker.
The consumer writes this once and imports it from both entry points.

## Extended by

- [`CqrsClientConfig`](CqrsClientConfig.md)

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

---

### cache?

> `optional` **cache**: [`CacheConfig`](CacheConfig.md)

Cache configuration.

---

### collections?

> `optional` **collections**: [`Collection`](Collection.md)[]

Collection configurations.

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Command sender for submitting commands to the server.
If not provided, commands are queued but not sent.

---

### debug?

> `optional` **debug**: `boolean`

Enable debug logging.

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

Domain executor for local command validation.
If not provided, commands are sent directly without local validation.

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Network configuration.

---

### processors?

> `optional` **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `Record`\<`string`, `unknown`\>\>[]

Event processors to register.
Processors transform domain events into read model updates.

---

### retainTerminal?

> `optional` **retainTerminal**: `boolean`

Retain terminal commands in storage for debugging/introspection.

---

### retry?

> `optional` **retry**: [`RetryConfig`](RetryConfig.md)

Retry configuration for commands.

---

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Storage configuration.

---

### workerSetup?

> `optional` **workerSetup**: `string`[]

Module URLs to dynamically import before initialization.
Use this to run setup code (e.g., logger bootstrap) inside the worker
before storage initialization.
