[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DEBUG_EVENT_TYPES

# Variable: DEBUG_EVENT_TYPES

> `const` **DEBUG_EVENT_TYPES**: `ReadonlySet`\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>

Defined in: [packages/client/src/types/events.ts:103](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L103)

Event types that exist purely for debug observability.
Filtered from CqrsClient.events$ unless `debug: true` is set in the config.
