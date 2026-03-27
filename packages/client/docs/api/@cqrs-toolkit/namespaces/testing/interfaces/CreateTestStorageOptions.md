[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / CreateTestStorageOptions

# Interface: CreateTestStorageOptions\<TLink\>

Options for creating test storage.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cachedEvents?

> `optional` **cachedEvents**: [`CachedEventRecord`](../../../../interfaces/CachedEventRecord.md)[]

Pre-populate with cached events

---

### cacheKeys?

> `optional` **cacheKeys**: [`CacheKeyRecord`](../../../../interfaces/CacheKeyRecord.md)[]

Pre-populate with cache keys

---

### commands?

> `optional` **commands**: [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`TLink`, `unknown`, `unknown`\>[]

Pre-populate with commands

---

### readModels?

> `optional` **readModels**: [`ReadModelRecord`](../../../../interfaces/ReadModelRecord.md)[]

Pre-populate with read models

---

### session?

> `optional` **session**: [`SessionRecord`](../../../../interfaces/SessionRecord.md)

Pre-populate with a session
