[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / hydrateCacheKeyIdentity

# Function: hydrateCacheKeyIdentity()

> **hydrateCacheKeyIdentity**\<`TLink`\>(`record`): [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Reconstitute a CacheKeyIdentity from a persisted CacheKeyRecord.
Used on startup to restore full identity data from storage.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### record

[`CacheKeyRecord`](../interfaces/CacheKeyRecord.md)

## Returns

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>
