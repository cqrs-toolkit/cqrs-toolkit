[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / withSchemaRegistry

# Function: withSchemaRegistry()

> **withSchemaRegistry**\<`TEvent`\>(`registry`, `handlers`): `CommandHandlerRegistration`\<`TEvent`, `JSONSchema7`\>[]

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

### TEvent

`TEvent` _extends_ `IAnticipatedEvent`\<`string`, `AggregateEventData`\> = `IAnticipatedEvent`\<`string`, `AggregateEventData`\>

## Parameters

### registry

[`SchemaRegistry`](../interfaces/SchemaRegistry.md)

### handlers

`CommandHandlerRegistration`\<`TEvent`, `JSONSchema7`\>[]

## Returns

`CommandHandlerRegistration`\<`TEvent`, `JSONSchema7`\>[]
