[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / CqrsClientConfig

# Interface: CqrsClientConfig\<TCommand, TEvent\>

Defined in: packages/client/src/types/config.ts:187

Main CQRS Client configuration.

## Type Parameters

### TCommand

`TCommand` = `unknown`

### TEvent

`TEvent` = `unknown`

## Properties

### cache?

> `optional` **cache**: [`CacheConfig`](CacheConfig.md)

Defined in: packages/client/src/types/config.ts:218

Cache configuration.

***

### collections?

> `optional` **collections**: [`Collection`](Collection.md)[]

Defined in: packages/client/src/types/config.ts:223

Collection configurations.

***

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)

Defined in: packages/client/src/types/config.ts:229

Command sender for submitting commands to the server.
If not provided, commands are queued but not sent.

***

### debug?

> `optional` **debug**: `boolean`

Defined in: packages/client/src/types/config.ts:245

Enable debug logging.

***

### domainExecutor?

> `optional` **domainExecutor**: [`IDomainExecutor`](IDomainExecutor.md)\<`TCommand`, `TEvent`\>

Defined in: packages/client/src/types/config.ts:198

Domain executor for local command validation.
If not provided, commands are sent directly without local validation.

***

### mode?

> `optional` **mode**: [`ExecutionModeConfig`](../type-aliases/ExecutionModeConfig.md)

Defined in: packages/client/src/types/config.ts:192

Execution mode.
Defaults to 'auto': SharedWorker > Dedicated Worker > Main Thread

***

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Defined in: packages/client/src/types/config.ts:203

Network configuration.

***

### processors?

> `optional` **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `unknown`\>[]

Defined in: packages/client/src/types/config.ts:235

Event processors to register.
Processors transform domain events into read model updates.

***

### retainTerminal?

> `optional` **retainTerminal**: `boolean`

Defined in: packages/client/src/types/config.ts:240

Retain terminal commands in storage for debugging/introspection.

***

### retry?

> `optional` **retry**: [`RetryConfig`](RetryConfig.md)

Defined in: packages/client/src/types/config.ts:213

Retry configuration for commands.

***

### storage?

> `optional` **storage**: [`StorageConfig`](StorageConfig.md)

Defined in: packages/client/src/types/config.ts:208

Storage configuration (ignored for online-only mode).

***

### workerSetup?

> `optional` **workerSetup**: `string`[]

Defined in: packages/client/src/types/config.ts:258

Module URLs to dynamically import in worker context.
Use this to run setup code (e.g., logger bootstrap) inside the worker
before storage initialization.

***

### workerUrl?

> `optional` **workerUrl**: `string`

Defined in: packages/client/src/types/config.ts:251

Worker script URL (for modes B and C).
If not provided, uses default bundled worker.
