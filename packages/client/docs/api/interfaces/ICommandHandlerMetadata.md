[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICommandHandlerMetadata

# Interface: ICommandHandlerMetadata\<TLink, TCommand, TSchema, TEvent\>

Metadata lookup for command handler registrations.
Allows the CommandQueue to access creates config by command type.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md) = [`EnqueueCommand`](EnqueueCommand.md)

### TSchema

`TSchema` = `unknown`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md) = [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Methods

### getRegistration()

> **getRegistration**(`commandType`): [`CommandHandlerRegistration`](../type-aliases/CommandHandlerRegistration.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\> \| `undefined`

#### Parameters

##### commandType

`string`

#### Returns

[`CommandHandlerRegistration`](../type-aliases/CommandHandlerRegistration.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\> \| `undefined`
