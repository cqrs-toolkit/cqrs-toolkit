[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / normalizeEventPersistence

# Function: normalizeEventPersistence()

> **normalizeEventPersistence**(`event`): [`EventPersistence`](../type-aliases/EventPersistence.md)

Normalize event persistence - missing field means Permanent.
Accepts the ddd-es persistence values ('Permanent' | 'Stateful' | 'Ephemeral') in addition
to the client-only 'Anticipated' value. Ephemeral events are not persisted, so this value
should never appear on an IPersistedEvent; if it does, we treat it as Permanent.

## Parameters

### event

#### persistence?

[`EventPersistence`](../type-aliases/EventPersistence.md) \| `"Ephemeral"`

## Returns

[`EventPersistence`](../type-aliases/EventPersistence.md)
