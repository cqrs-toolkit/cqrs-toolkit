[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / DedicatedWorkerAdapterConfig

# Interface: DedicatedWorkerAdapterConfig

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:24

Configuration for DedicatedWorkerAdapter.

## Extends

- [`ResolvedConfig`](ResolvedConfig.md)

## Properties

### cache

> **cache**: [`CacheConfig`](CacheConfig.md)

Defined in: packages/client/src/types/config.ts:218

Cache configuration.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`cache`](ResolvedConfig.md#cache)

***

### collections

> **collections**: [`Collection`](Collection.md)[]

Defined in: packages/client/src/types/config.ts:299

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`collections`](ResolvedConfig.md#collections)

***

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/types/config.ts:296

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`commandSender`](ResolvedConfig.md#commandsender)

***

### debug

> **debug**: `boolean`

Defined in: packages/client/src/types/config.ts:245

Enable debug logging.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`debug`](ResolvedConfig.md#debug)

***

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`unknown`, `unknown`\>

Defined in: packages/client/src/types/config.ts:295

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`domainExecutor`](ResolvedConfig.md#domainexecutor)

***

### mode

> **mode**: [`ExecutionModeConfig`](../type-aliases/ExecutionModeConfig.md)

Defined in: packages/client/src/types/config.ts:192

Execution mode.
Defaults to 'auto': SharedWorker > Dedicated Worker > Main Thread

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`mode`](ResolvedConfig.md#mode)

***

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Defined in: packages/client/src/types/config.ts:203

Network configuration.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`network`](ResolvedConfig.md#network)

***

### processors

> **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `unknown`\>[]

Defined in: packages/client/src/types/config.ts:300

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`processors`](ResolvedConfig.md#processors)

***

### retainTerminal

> **retainTerminal**: `boolean`

Defined in: packages/client/src/types/config.ts:240

Retain terminal commands in storage for debugging/introspection.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`retainTerminal`](ResolvedConfig.md#retainterminal)

***

### retry

> **retry**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/types/config.ts:213

Retry configuration for commands.

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`retry`](ResolvedConfig.md#retry)

***

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Defined in: packages/client/src/types/config.ts:208

Storage configuration (ignored for online-only mode).

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`storage`](ResolvedConfig.md#storage)

***

### workerSetup?

> `optional` **workerSetup**: `string`[]

Defined in: packages/client/src/types/config.ts:298

#### Inherited from

[`ResolvedConfig`](ResolvedConfig.md).[`workerSetup`](ResolvedConfig.md#workersetup)

***

### workerUrl

> **workerUrl**: `string`

Defined in: packages/client/src/adapters/dedicated-worker/DedicatedWorkerAdapter.ts:26

URL to the Dedicated Worker script

#### Overrides

[`ResolvedConfig`](ResolvedConfig.md).[`workerUrl`](ResolvedConfig.md#workerurl)
