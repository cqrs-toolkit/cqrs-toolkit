[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsConfig

# Interface: CqrsConfig\<TLink, TCommand, TSchema, TEvent\>

Shared CQRS configuration.

Contains all domain-level settings shared between the main thread and worker.
The consumer writes this once and imports it from both entry points.

## Extended by

- [`CqrsClientConfig`](CqrsClientConfig.md)

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../type-aliases/EnqueueCommand.md)

### TSchema

`TSchema` = `unknown`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md) = [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Properties

### aggregates

> **aggregates**: [`ClientAggregatesConfig`](../type-aliases/ClientAggregatesConfig.md)\<`TLink`\>

Aggregate registry and stream ID parser.

---

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

### collations?

> `optional` **collations**: readonly [`CollationConfig`](CollationConfig.md)[]

Custom SQLite collating sequences. Registered against every database
connection the client opens; referenced from [CustomColumn.collation](CustomColumn.md#collation)
by name. The same comparator is used by the JS-side fallback sort in
Mode A so list ordering stays consistent across backends. See
[CollationConfig](CollationConfig.md).

---

### collections?

> `optional` **collections**: [`Collection`](Collection.md)\<`TLink`\>[]

Collection configurations.

---

### commandHandlers?

> `optional` **commandHandlers**: [`CommandHandlerRegistration`](../type-aliases/CommandHandlerRegistration.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>[]

Command handler registrations for local validation and optimistic updates.
Each handler validates command data and produces anticipated events.
If not provided, commands are sent directly without local validation.

---

### commandSender?

> `optional` **commandSender**: [`ICommandSender`](ICommandSender.md)\<`TLink`, `TCommand`\>

Command sender for submitting commands to the server.
If not provided, commands are queued but not sent.

---

### debug?

> `optional` **debug**: `boolean`

Enable debug logging.

---

### logger?

> `optional` **logger**: `ILogger`

Logger to install via `logProvider.setLogger(...)` at bootstrap.

When provided, the client honours it verbatim — consumers wiring Pino
or their own transport keep full control over level, format, and
destination. When omitted, the client falls back to the built-in
wiring: EventBusLogger in debug mode (so log calls land on
`client.events$` alongside library events) or a plain console logger
at `warn` otherwise.

Applies on both main thread and worker — pass the same logger via the
shared config and both sides install it.

---

### mapFailure?

> `optional` **mapFailure**: [`FailureMapper`](../type-aliases/FailureMapper.md)

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

---

### network

> **network**: [`NetworkConfig`](NetworkConfig.md)

Network configuration.

---

### processors?

> `optional` **processors**: [`ProcessorRegistration`](ProcessorRegistration.md)\<`unknown`, `object`\>[]

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

### schemaValidator?

> `optional` **schemaValidator**: [`SchemaValidator`](SchemaValidator.md)\<`TSchema`\>

Schema validator implementation for structural validation.
Required if any command handler registration has a `schema` property.
The generic `TSchema` enforces that the validator and all registrations
agree on the schema type (JSONSchema7, z.ZodType, etc.).

---

### storage

> **storage**: [`StorageConfig`](StorageConfig.md)

Storage configuration.

---

### views?

> `optional` **views**: [`AnyViewRegistration`](../type-aliases/AnyViewRegistration.md)\<`TLink`\>[]

Cross-collection view registrations. Each entry pairs a sync in-memory
implementation with an async SQL implementation; the library dispatches
based on the active storage backend.

View names must be unique; duplicates throw at executor construction.
Each registration's `cacheKeys` callback resolves the declared keys per
call. [IQueryManager.getView](IQueryManager.md#getview) and [IQueryManager.watchView](IQueryManager.md#watchview)
are both hold-agnostic — they touch the resolved identities (so any
existing holds don't age out) but don't pin them. `createViewQuery` in
`@cqrs-toolkit/client-solid` wraps `watchView` and holds the resolved
identities for the subscription's lifetime; direct `getView` /
`watchView` callers own whatever lifecycle they want.

---

### workerSetup?

> `optional` **workerSetup**: `string`[]

Module URLs to dynamically import before initialization.
Use this to run setup code (e.g., logger bootstrap) inside the worker
before storage initialization.
