[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheConfig

# Interface: CacheConfig

Cache configuration.

## Properties

### defaultTtl?

> `optional` **defaultTtl**: `number`

Default TTL for cache keys in milliseconds

---

### evictionPolicy?

> `optional` **evictionPolicy**: `"lru"` \| `"fifo"`

Eviction policy

---

### maxCacheKeys?

> `optional` **maxCacheKeys**: `number`

Maximum number of cache keys

---

### maxWindows?

> `optional` **maxWindows**: `number`

Maximum number of windows/tabs that can hold cache keys simultaneously
