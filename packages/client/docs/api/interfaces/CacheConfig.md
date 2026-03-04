[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheConfig

# Interface: CacheConfig

Defined in: packages/client/src/types/config.ts:74

Cache configuration.

## Properties

### defaultTtl?

> `optional` **defaultTtl**: `number`

Defined in: packages/client/src/types/config.ts:78

Default TTL for cache keys in milliseconds

---

### evictionPolicy?

> `optional` **evictionPolicy**: `"lru"` \| `"fifo"`

Defined in: packages/client/src/types/config.ts:80

Eviction policy

---

### maxCacheKeys?

> `optional` **maxCacheKeys**: `number`

Defined in: packages/client/src/types/config.ts:76

Maximum number of cache keys

---

### maxWindows?

> `optional` **maxWindows**: `number`

Defined in: packages/client/src/types/config.ts:82

Maximum number of windows/tabs that can hold cache keys simultaneously
