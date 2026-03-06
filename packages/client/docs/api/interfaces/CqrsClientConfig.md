[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClientConfig

# Interface: CqrsClientConfig\<TCommand, TEvent\>

Defined in: [packages/client/src/types/config.ts:260](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L260)

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

### cache?

> `optional` **cache**: [`CacheConfig`](CacheConfig.md)

Defined in: [packages/client/src/types/config.ts:217](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L217)

Cache configuration.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`cache`](CqrsConfig.md#cache)

---

### collections?

> `optional` **collections**: [`Collection`](Collection.md)[]

Defined in: [packages/client/src/types/config.ts:222](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L222)

Collection configurations.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`collections`](CqrsConfig.md#collections)

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: [packages/client/src/types/config.ts:228](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L228)

Command sender for submitting commands to the server.
If not provided, commands are queued but not sent.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`commandSender`](CqrsConfig.md#commandsender)

---

### debug?

> `optional` **debug**: `boolean`

Defined in: [packages/client/src/types/config.ts:244](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L244)

Enable debug logging.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`debug`](CqrsConfig.md#debug)

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

Defined in: [packages/client/src/types/config.ts:197](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L197)

Domain executor for local command validation.
If not provided, commands are sent directly without local validation.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`domainExecutor`](CqrsConfig.md#domainexecutor)

---

### mode?

> `optional` **mode**: [`ExecutionModeConfig`](../type-aliases/ExecutionModeConfig.md)

Defined in: [packages/client/src/types/config.ts:268](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L268)

Execution mode.
Defaults to 'auto': SharedWorker > Dedicated Worker > Online-only

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Defined in: [packages/client/src/types/config.ts:202](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L202)

Network configuration.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`network`](CqrsConfig.md#network)

---

### processors?

> `optional` **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `Record`\<`string`, `unknown`\>\>[]

Defined in: [packages/client/src/types/config.ts:234](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L234)

Event processors to register.
Processors transform domain events into read model updates.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`processors`](CqrsConfig.md#processors)

---

### retainTerminal?

> `optional` **retainTerminal**: `boolean`

Defined in: [packages/client/src/types/config.ts:239](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L239)

Retain terminal commands in storage for debugging/introspection.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`retainTerminal`](CqrsConfig.md#retainterminal)

---

### retry?

> `optional` **retry**: [`RetryConfig`](RetryConfig.md)

Defined in: [packages/client/src/types/config.ts:212](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L212)

Retry configuration for commands.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`retry`](CqrsConfig.md#retry)

---

### sqliteWorkerUrl?

> `optional` **sqliteWorkerUrl**: `string`

Defined in: [packages/client/src/types/config.ts:286](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L286)

Per-tab SQLite DedicatedWorker URL for Mode C.
Each tab spawns a DedicatedWorker at this URL for SQLite I/O
(OPFS `createSyncAccessHandle` requires a DedicatedWorker context).

Required for shared-worker mode. Must be resolved on the main thread
where the bundler can process asset URL imports (e.g., Vite's
`?worker&url` suffix).

---

### storage?

> `optional` **storage**: [`StorageConfig`](StorageConfig.md)

Defined in: [packages/client/src/types/config.ts:207](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L207)

Storage configuration (ignored for online-only mode).

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`storage`](CqrsConfig.md#storage)

---

### workerSetup?

> `optional` **workerSetup**: `string`[]

Defined in: [packages/client/src/types/config.ts:251](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L251)

Module URLs to dynamically import before initialization.
Use this to run setup code (e.g., logger bootstrap) inside the worker
before storage initialization.

#### Inherited from

[`CqrsConfig`](CqrsConfig.md).[`workerSetup`](CqrsConfig.md#workersetup)

---

### workerUrl?

> `optional` **workerUrl**: `string`

Defined in: [packages/client/src/types/config.ts:275](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/config.ts#L275)

SharedWorker script URL (Mode C) or DedicatedWorker script URL (Mode B).
Points to the consumer's worker entry point that calls
startDedicatedWorker() or startSharedWorker().
