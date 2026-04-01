[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / withSchemaRegistry

# Function: withSchemaRegistry()

> **withSchemaRegistry**\<`TLink`, `TCommand`, `TEvent`\>(`registry`, `handlers`): `CommandHandlerRegistration`\<`TLink`, `TCommand`, `JSONSchema7`, `TEvent`\>[]

Inject schemas from a registry onto command handler registrations.

For each handler without an explicit `schema`, looks up
`registry.commands[handler.commandType]`. If found, returns a copy with
`schema` set. Handlers that already have a `schema` property are not modified.

```ts
import { schemas } from './.cqrs/schemas.js'
import { withSchemaRegistry } from '@cqrs-toolkit/hypermedia-client'

commandHandlers: withSchemaRegistry(schemas, [...todoHandlers, ...noteHandlers])
```

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ `EnqueueCommand`\<`unknown`\>

### TEvent

`TEvent` _extends_ `IAnticipatedEvent`\<`string`, `AggregateEventData`\>

## Parameters

### registry

[`SchemaRegistry`](../interfaces/SchemaRegistry.md)

### handlers

`CommandHandlerRegistration`\<`TLink`, `TCommand`, `JSONSchema7`, `TEvent`\>[]

## Returns

`CommandHandlerRegistration`\<`TLink`, `TCommand`, `JSONSchema7`, `TEvent`\>[]
