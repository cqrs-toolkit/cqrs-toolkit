[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / DEBUG_EVENT_TYPES

# Variable: DEBUG_EVENT_TYPES

> `const` **DEBUG_EVENT_TYPES**: `ReadonlySet`\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>

Defined in: packages/client/src/types/events.ts:103

Event types that exist purely for debug observability.
Filtered from CqrsClient.events$ unless `debug: true` is set in the config.
