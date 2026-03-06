[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheEventOptions

# Interface: CacheEventOptions

Defined in: [packages/client/src/core/event-cache/EventCache.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L32)

Options for caching an event.

## Properties

### cacheKey

> **cacheKey**: `string`

Defined in: [packages/client/src/core/event-cache/EventCache.ts:34](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L34)

Cache key to associate with

---

### commandId?

> `optional` **commandId**: `string`

Defined in: [packages/client/src/core/event-cache/EventCache.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/event-cache/EventCache.ts#L36)

For anticipated events, the command ID
