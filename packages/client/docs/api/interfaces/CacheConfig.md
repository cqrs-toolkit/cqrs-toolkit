[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / CacheConfig

# Interface: CacheConfig

Defined in: packages/client/src/types/config.ts:73

Cache configuration.

## Properties

### defaultTtl?

> `optional` **defaultTtl**: `number`

Defined in: packages/client/src/types/config.ts:77

Default TTL for cache keys in milliseconds

---

### evictionPolicy?

> `optional` **evictionPolicy**: `"lru"` \| `"fifo"`

Defined in: packages/client/src/types/config.ts:79

Eviction policy

---

### maxCacheKeys?

> `optional` **maxCacheKeys**: `number`

Defined in: packages/client/src/types/config.ts:75

Maximum number of cache keys
