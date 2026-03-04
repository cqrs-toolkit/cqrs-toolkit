[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SharedWorkerAdapterConfig

# Interface: SharedWorkerAdapterConfig

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:25

Configuration for SharedWorkerAdapter.

## Extends

- [`ResolvedConfig`](ResolvedConfig.md)

## Properties

### cache

> **cache**: [`CacheConfig`](CacheConfig.md)

Defined in: packages/client/src/types/config.ts:221

Cache configuration.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`cache`](ResolvedConfig.md#cache)

---

### collections

> **collections**: [`Collection`](Collection.md)[]

Defined in: packages/client/src/types/config.ts:303

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`collections`](ResolvedConfig.md#collections)

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/types/config.ts:300

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`commandSender`](ResolvedConfig.md#commandsender)

---

### debug

> **debug**: `boolean`

Defined in: packages/client/src/types/config.ts:248

Enable debug logging.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`debug`](ResolvedConfig.md#debug)

---

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`unknown`, `unknown`\>

Defined in: packages/client/src/types/config.ts:299

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`domainExecutor`](ResolvedConfig.md#domainexecutor)

---

### heartbeatInterval?

> `optional` **heartbeatInterval**: `number`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:29

Heartbeat interval in milliseconds (default: 10000)

---

### mode

> **mode**: [`ExecutionModeConfig`](../type-aliases/ExecutionModeConfig.md)

Defined in: packages/client/src/types/config.ts:195

Execution mode.
Defaults to 'auto': SharedWorker > Dedicated Worker > Main Thread

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`mode`](ResolvedConfig.md#mode)

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Defined in: packages/client/src/types/config.ts:206

Network configuration.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`network`](ResolvedConfig.md#network)

---

### processors

> **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `Record`\<`string`, `unknown`\>\>[]

Defined in: packages/client/src/types/config.ts:304

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`processors`](ResolvedConfig.md#processors)

---

### retainTerminal

> **retainTerminal**: `boolean`

Defined in: packages/client/src/types/config.ts:243

Retain terminal commands in storage for debugging/introspection.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`retainTerminal`](ResolvedConfig.md#retainterminal)

---

### retry

> **retry**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/types/config.ts:216

Retry configuration for commands.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`retry`](ResolvedConfig.md#retry)

---

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Defined in: packages/client/src/types/config.ts:211

Storage configuration (ignored for online-only mode).

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`storage`](ResolvedConfig.md#storage)

---

### workerSetup?

> `optional` **workerSetup**: `string`[]

Defined in: packages/client/src/types/config.ts:302

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`workerSetup`](ResolvedConfig.md#workersetup)

---

### workerUrl

> **workerUrl**: `string`

Defined in: packages/client/src/adapters/shared-worker/SharedWorkerAdapter.ts:27

URL to the SharedWorker script

#### Overrides

[`ResolvedConfig`](ResolvedConfig.md).[`workerUrl`](ResolvedConfig.md#workerurl)
