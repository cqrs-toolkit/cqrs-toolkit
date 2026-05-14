[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IAnticipatedEvent

# Interface: IAnticipatedEvent\<Type, Data\>

Client-side anticipated event shape.

Mirrors ddd-es `IEvent` but scoped to client-side event generation:

- `type` and `data` from `IEvent`
- `streamId` for stream routing (from `IPersistedEvent`)
- `metadata` optional, looser than ddd-es `EventMetadata` — no required
  `correlationId` or tracing fields (those are server-side concerns; client
  anticipated events don't need them). Carries app-domain context that the
  handler wants to ride into the event for projector consumption — typically
  ancestor-scoping ids like `inTenant` that the server's persisted-event
  metadata also carries, so projector code reads from the same location on
  anticipated and persisted events.
- No `persistence` (not needed client-side).
- `Data` extends `AnticipatedEventData` (requires `{ readonly id: EntityId }`)
  without an index signature — consumers get exact type checking on data.

Consumers write typed event unions for type-safe handlers:

```typescript
type TodoCreatedEvent = IAnticipatedEvent<
  'TodoCreated',
  {
    readonly id: EntityId
    readonly content: string
  }
>
type TodoEvent = TodoCreatedEvent | TodoDeletedEvent
```

## Type Parameters

### Type

`Type` _extends_ `string` = `string`

### Data

`Data` _extends_ `AnticipatedAggregateEventData` = `AnticipatedAggregateEventData`

## Properties

### data

> **data**: `Data`

---

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

---

### streamId

> **streamId**: `string`

---

### type

> **type**: `Type`
