[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICommandHandlerMetadata

# Interface: ICommandHandlerMetadata\<TLink, TSchema, TEvent\>

Metadata lookup for command handler registrations.
Allows the CommandQueue to access creates config by command type.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TSchema

`TSchema` = `unknown`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md) = [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Methods

### getRegistration()

> **getRegistration**(`commandType`): [`CommandHandlerRegistration`](CommandHandlerRegistration.md)\<`TLink`, `TSchema`, `TEvent`\> \| `undefined`

#### Parameters

##### commandType

`string`

#### Returns

[`CommandHandlerRegistration`](CommandHandlerRegistration.md)\<`TLink`, `TSchema`, `TEvent`\> \| `undefined`
