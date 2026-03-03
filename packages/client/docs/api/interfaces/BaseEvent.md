[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / BaseEvent

# Interface: BaseEvent\<TPayload\>

Defined in: packages/client/src/types/events.ts:57

Generic event wrapper type.
Domain events extend this with their specific payload.

## Type Parameters

### TPayload

`TPayload` = `unknown`

## Properties

### data

> **data**: `TPayload`

Defined in: packages/client/src/types/events.ts:61

Event payload

---

### streamId

> **streamId**: `string`

Defined in: packages/client/src/types/events.ts:63

Stream/aggregate identifier

---

### type

> **type**: `string`

Defined in: packages/client/src/types/events.ts:59

Event type name (e.g., 'TodoCreated', 'UserUpdated')
