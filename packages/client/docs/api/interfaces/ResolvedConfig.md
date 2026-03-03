[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ResolvedConfig

# Interface: ResolvedConfig\<TCommand, TEvent\>

Defined in: packages/client/src/types/config.ts:289

Resolved configuration with all defaults applied.

## Extends

- `Required`\<`Omit`\<[`CqrsClientConfig`](CqrsClientConfig.md)\<`TCommand`, `TEvent`\>, `"domainExecutor"` \| `"commandSender"` \| `"workerUrl"` \| `"workerSetup"` \| `"collections"` \| `"processors"`\>\>

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

Defined in: packages/client/src/types/config.ts:218

Cache configuration.

#### Inherited from

`Required.cache`

***

### collections

> **collections**: [`Collection`](Collection.md)[]

Defined in: packages/client/src/types/config.ts:299

***

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/types/config.ts:296

***

### debug

> **debug**: `boolean`

Defined in: packages/client/src/types/config.ts:245

Enable debug logging.

#### Inherited from

`Required.debug`

***

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

Defined in: packages/client/src/types/config.ts:295

***

### mode

> **mode**: [`ExecutionModeConfig`](../type-aliases/ExecutionModeConfig.md)

Defined in: packages/client/src/types/config.ts:192

Execution mode.
Defaults to 'auto': SharedWorker > Dedicated Worker > Main Thread

#### Inherited from

`Required.mode`

***

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Defined in: packages/client/src/types/config.ts:203

Network configuration.

#### Inherited from

`Required.network`

***

### processors

> **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `unknown`\>[]

Defined in: packages/client/src/types/config.ts:300

***

### retainTerminal

> **retainTerminal**: `boolean`

Defined in: packages/client/src/types/config.ts:240

Retain terminal commands in storage for debugging/introspection.

#### Inherited from

`Required.retainTerminal`

***

### retry

> **retry**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/types/config.ts:213

Retry configuration for commands.

#### Inherited from

`Required.retry`

***

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Defined in: packages/client/src/types/config.ts:208

Storage configuration (ignored for online-only mode).

#### Inherited from

`Required.storage`

***

### workerSetup?

> `optional` **workerSetup**: `string`[]

Defined in: packages/client/src/types/config.ts:298

***

### workerUrl?

> `optional` **workerUrl**: `string`

Defined in: packages/client/src/types/config.ts:297
