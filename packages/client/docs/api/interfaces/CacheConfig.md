[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheConfig

# Interface: CacheConfig

Defined in: packages/client/src/types/config.ts:75

Cache configuration.

## Properties

### defaultTtl?

> `optional` **defaultTtl**: `number`

Defined in: packages/client/src/types/config.ts:79

Default TTL for cache keys in milliseconds

---

### evictionPolicy?

> `optional` **evictionPolicy**: `"lru"` \| `"fifo"`

Defined in: packages/client/src/types/config.ts:81

Eviction policy

---

### maxCacheKeys?

> `optional` **maxCacheKeys**: `number`

Defined in: packages/client/src/types/config.ts:77

Maximum number of cache keys

---

### maxWindows?

> `optional` **maxWindows**: `number`

Defined in: packages/client/src/types/config.ts:83

Maximum number of windows/tabs that can hold cache keys simultaneously
