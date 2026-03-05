[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsConfig

# Interface: CqrsConfig\<TCommand, TEvent\>

Defined in: packages/client/src/types/config.ts:192

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

### cache?

> `optional` **cache**: [`CacheConfig`](CacheConfig.md)

Defined in: packages/client/src/types/config.ts:217

Cache configuration.

---

### collections?

> `optional` **collections**: [`Collection`](Collection.md)[]

Defined in: packages/client/src/types/config.ts:222

Collection configurations.

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/types/config.ts:228

Command sender for submitting commands to the server.
If not provided, commands are queued but not sent.

---

### debug?

> `optional` **debug**: `boolean`

Defined in: packages/client/src/types/config.ts:244

Enable debug logging.

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

Defined in: packages/client/src/types/config.ts:197

Domain executor for local command validation.
If not provided, commands are sent directly without local validation.

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Defined in: packages/client/src/types/config.ts:202

Network configuration.

---

### processors?

> `optional` **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `Record`\<`string`, `unknown`\>\>[]

Defined in: packages/client/src/types/config.ts:234

Event processors to register.
Processors transform domain events into read model updates.

---

### retainTerminal?

> `optional` **retainTerminal**: `boolean`

Defined in: packages/client/src/types/config.ts:239

Retain terminal commands in storage for debugging/introspection.

---

### retry?

> `optional` **retry**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/types/config.ts:212

Retry configuration for commands.

---

### storage?

> `optional` **storage**: [`StorageConfig`](StorageConfig.md)

Defined in: packages/client/src/types/config.ts:207

Storage configuration (ignored for online-only mode).

---

### workerSetup?

> `optional` **workerSetup**: `string`[]

Defined in: packages/client/src/types/config.ts:251

Module URLs to dynamically import before initialization.
Use this to run setup code (e.g., logger bootstrap) inside the worker
before storage initialization.
