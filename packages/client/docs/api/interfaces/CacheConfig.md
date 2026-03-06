[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheConfig

# Interface: CacheConfig

Defined in: [packages/client/src/types/config.ts:74](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/config.ts#L74)

Cache configuration.

## Properties

### defaultTtl?

> `optional` **defaultTtl**: `number`

Defined in: [packages/client/src/types/config.ts:78](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/config.ts#L78)

Default TTL for cache keys in milliseconds

---

### evictionPolicy?

> `optional` **evictionPolicy**: `"lru"` \| `"fifo"`

Defined in: [packages/client/src/types/config.ts:80](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/config.ts#L80)

Eviction policy

---

### maxCacheKeys?

> `optional` **maxCacheKeys**: `number`

Defined in: [packages/client/src/types/config.ts:76](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/config.ts#L76)

Maximum number of cache keys

---

### maxWindows?

> `optional` **maxWindows**: `number`

Defined in: [packages/client/src/types/config.ts:82](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/config.ts#L82)

Maximum number of windows/tabs that can hold cache keys simultaneously
