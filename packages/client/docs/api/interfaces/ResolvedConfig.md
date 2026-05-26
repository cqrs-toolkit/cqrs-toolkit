[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ResolvedConfig

# Interface: ResolvedConfig\<TLink, TCommand, TSchema, TEvent\>

Resolved shared configuration with all defaults applied.

## Extends

- `Required`\<`Omit`\<[`CqrsConfig`](CqrsConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>, `"commandHandlers"` \| `"commandSender"` \| `"schemaValidator"` \| `"workerSetup"` \| `"collections"` \| `"processors"` \| `"logger"` \| `"views"`\>\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../type-aliases/EnqueueCommand.md)

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Properties

### aggregates

> **aggregates**: [`ClientAggregatesConfig`](../type-aliases/ClientAggregatesConfig.md)\<`TLink`\>

Aggregate registry and stream ID parser.

#### Inherited from

`Required.aggregates`

---

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

### collations

> **collations**: readonly [`CollationConfig`](CollationConfig.md)[]

Custom SQLite collating sequences. Registered against every database
connection the client opens; referenced from [CustomColumn.collation](CustomColumn.md#collation)
by name. The same comparator is used by the JS-side fallback sort in
Mode A so list ordering stays consistent across backends. See
[CollationConfig](CollationConfig.md).

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`collations`](CqrsClientConfig.md#collations)

---

### collections

> **collections**: [`Collection`](Collection.md)\<`TLink`\>[]

---

### commandHandlers

> **commandHandlers**: [`CommandHandlerRegistration`](../type-aliases/CommandHandlerRegistration.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>[]

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)\<`TLink`, `TCommand`\>

---

### debug

> **debug**: `boolean`

Enable debug logging.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`debug`](CqrsClientConfig.md#debug)

---

### logger?

> `optional` **logger**: `ILogger`

---

### mapFailure

> **mapFailure**: [`FailureMapper`](../type-aliases/FailureMapper.md)

Project-wide pluggable mapping from [ServerErrorResponse](ServerErrorResponse.md) (parsed
server error) to [FailureDescriptor](FailureDescriptor.md). Runs when no per-command
`mapFailure` on a [CommandHandlerRegistration](../type-aliases/CommandHandlerRegistration.md) is defined for the
failing command type. Defaults to `defaultProblemJsonMapper` (RFC 9457
problem+json — the project's canonical error format) when omitted.

Consumers using a different convention (ld+json, bespoke `body.name`,
etc.) supply their own implementation. Library-shipped helpers in
`core/failure-mapper` (`defaultStatusMapper`, `defaultLdJsonMapper`,
etc.) compose into custom mappers.

Resolution: per-command `mapFailure` is the sole arbiter when defined
(no automatic cascade). Consumers wanting "global behaviour for non-
special cases" import this function reference directly inside the
per-command handler and call it explicitly.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`mapFailure`](CqrsClientConfig.md#mapfailure)

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Network configuration.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`network`](CqrsClientConfig.md#network)

---

### processors

> **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `object`\>[]

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

### schemaValidator?

> `optional` **schemaValidator**: [`SchemaValidator`](SchemaValidator.md)\<`unknown`\>

---

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Storage configuration.

#### Inherited from

[`CqrsClientConfig`](CqrsClientConfig.md).[`storage`](CqrsClientConfig.md#storage)

---

### views

> **views**: [`AnyViewRegistration`](../type-aliases/AnyViewRegistration.md)\<`TLink`\>[]

---

### workerSetup?

> `optional` **workerSetup**: `string`[]
