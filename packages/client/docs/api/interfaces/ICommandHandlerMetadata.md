[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ICommandHandlerMetadata

# Interface: ICommandHandlerMetadata

Metadata lookup for command handler registrations.
Allows the CommandQueue to access creates config by command type.

## Methods

### getRegistration()

> **getRegistration**(`commandType`): [`CommandHandlerRegistration`](CommandHandlerRegistration.md)\<[`IAnticipatedEvent`](IAnticipatedEvent.md)\<`string`, `AggregateEventData`\>, `unknown`\> \| `undefined`

#### Parameters

##### commandType

`string`

#### Returns

[`CommandHandlerRegistration`](CommandHandlerRegistration.md)\<[`IAnticipatedEvent`](IAnticipatedEvent.md)\<`string`, `AggregateEventData`\>, `unknown`\> \| `undefined`
