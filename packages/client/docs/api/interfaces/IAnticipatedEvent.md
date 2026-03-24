[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IAnticipatedEvent

# Interface: IAnticipatedEvent\<Type, Data\>

Client-side anticipated event shape.

Mirrors ddd-es `IEvent` but scoped to client-side event generation:

- `type` and `data` from `IEvent`
- `streamId` for stream routing (from `IPersistedEvent`)
- No `metadata` (TBD) or `persistence` (not needed client-side)
- `Data` extends `AggregateEventData` (requires `{ readonly id: string }`)
  without an index signature — consumers get exact type checking on data.

Consumers write typed event unions for type-safe handlers:

```typescript
type TodoCreatedEvent = IAnticipatedEvent<
  'TodoCreated',
  {
    readonly id: string
    readonly content: string
  }
>
type TodoEvent = TodoCreatedEvent | TodoDeletedEvent
```

## Type Parameters

### Type

`Type` _extends_ `string` = `string`

### Data

`Data` _extends_ `AggregateEventData` = `AggregateEventData`

## Properties

### data

> **data**: `Data`

---

### streamId

> **streamId**: `string`

---

### type

> **type**: `Type`
