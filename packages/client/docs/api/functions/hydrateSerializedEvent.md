[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / hydrateSerializedEvent

# Function: hydrateSerializedEvent()

> **hydrateSerializedEvent**(`event`): [`IPersistedEvent`](../type-aliases/IPersistedEvent.md)

Defined in: [packages/client/src/types/events.ts:131](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L131)

Hydrate a serialized event (JSON wire format) into a persisted event.
Converts string revision/position to bigint. All other fields pass through unchanged.

Use this in Collection fetch method implementations to convert server JSON
responses into the IPersistedEvent type the library expects.

## Parameters

### event

[`ISerializedEvent`](../type-aliases/ISerializedEvent.md)

## Returns

[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)
