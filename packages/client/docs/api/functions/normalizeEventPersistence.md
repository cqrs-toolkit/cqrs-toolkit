[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / normalizeEventPersistence

# Function: normalizeEventPersistence()

> **normalizeEventPersistence**(`event`): [`EventPersistence`](../type-aliases/EventPersistence.md)

Normalize event persistence - missing field means Permanent.
Accepts the ddd-es persistence values ('Permanent' | 'Stateful' | 'Ephemeral') in addition
to the client-only 'Anticipated' value.

## Parameters

### event

#### persistence?

[`EventPersistence`](../type-aliases/EventPersistence.md)

## Returns

[`EventPersistence`](../type-aliases/EventPersistence.md)
