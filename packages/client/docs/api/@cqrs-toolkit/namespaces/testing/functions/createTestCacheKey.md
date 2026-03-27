[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createTestCacheKey

# Function: createTestCacheKey()

> **createTestCacheKey**(`overrides?`): [`CacheKeyRecord`](../../../../interfaces/CacheKeyRecord.md)

Create a test cache key record with sensible defaults.

Enforces coherence between `frozen` and `frozenAt`:

- `frozen: true` without explicit `frozenAt` → `frozenAt` set to current time
- `frozen: false` → `frozenAt` forced to `null`

## Parameters

### overrides?

`Partial`\<[`CacheKeyRecord`](../../../../interfaces/CacheKeyRecord.md)\> = `{}`

Optional field overrides

## Returns

[`CacheKeyRecord`](../../../../interfaces/CacheKeyRecord.md)

Cache key record
