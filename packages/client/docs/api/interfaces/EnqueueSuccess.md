[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueSuccess

# Interface: EnqueueSuccess\<TEvent\>

Successful enqueue data.

## Type Parameters

### TEvent

`TEvent`

## Properties

### anticipatedEvents

> **anticipatedEvents**: `TEvent`[]

Anticipated events produced

---

### commandId

> **commandId**: `string`

Assigned command ID

---

### entityRef?

> `optional` **entityRef**: [`EntityRef`](EntityRef.md)

EntityRef for the created entity, if this was a create command.
