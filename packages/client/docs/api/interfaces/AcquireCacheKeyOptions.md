[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AcquireCacheKeyOptions

# Interface: AcquireCacheKeyOptions

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:32

Options for acquiring a cache key.

## Properties

### evictionPolicy?

> `optional` **evictionPolicy**: `"persistent"` \| `"ephemeral"`

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:40

Eviction policy for new keys (default: 'persistent')

---

### hold?

> `optional` **hold**: `boolean`

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:34

Whether to place a hold (prevents eviction)

---

### scope?

> `optional` **scope**: `string`

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:38

Scope for the cache key

---

### ttl?

> `optional` **ttl**: `number`

Defined in: packages/client/src/core/cache-manager/CacheManager.ts:36

TTL in milliseconds (overrides default)
