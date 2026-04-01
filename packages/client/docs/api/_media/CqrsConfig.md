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

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md)

### TSchema

`TSchema` = `unknown`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md) = [`IAnticipatedEvent`](IAnticipatedEvent.md)

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

> `optional` **collections**: [`Collection`](Collection.md)\<`TLink`\>[]

Collection configurations.

---

### commandHandlers?

> `optional` **commandHandlers**: [`CommandHandlerRegistration`](CommandHandlerRegistration.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>[]

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

### workerSetup?

> `optional` **workerSetup**: `string`[]

Module URLs to dynamically import before initialization.
Use this to run setup code (e.g., logger bootstrap) inside the worker
before storage initialization.
