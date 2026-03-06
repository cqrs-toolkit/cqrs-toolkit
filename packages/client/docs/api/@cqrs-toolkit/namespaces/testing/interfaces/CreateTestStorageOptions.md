[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / CreateTestStorageOptions

# Interface: CreateTestStorageOptions

Defined in: [packages/client/src/testing/createTestStorage.ts:19](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/testing/createTestStorage.ts#L19)

Options for creating test storage.

## Properties

### cachedEvents?

> `optional` **cachedEvents**: [`CachedEventRecord`](../../../../interfaces/CachedEventRecord.md)[]

Defined in: [packages/client/src/testing/createTestStorage.ts:27](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/testing/createTestStorage.ts#L27)

Pre-populate with cached events

---

### cacheKeys?

> `optional` **cacheKeys**: [`CacheKeyRecord`](../../../../interfaces/CacheKeyRecord.md)[]

Defined in: [packages/client/src/testing/createTestStorage.ts:23](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/testing/createTestStorage.ts#L23)

Pre-populate with cache keys

---

### commands?

> `optional` **commands**: [`CommandRecord`](../../../../interfaces/CommandRecord.md)\<`unknown`, `unknown`\>[]

Defined in: [packages/client/src/testing/createTestStorage.ts:25](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/testing/createTestStorage.ts#L25)

Pre-populate with commands

---

### readModels?

> `optional` **readModels**: [`ReadModelRecord`](../../../../interfaces/ReadModelRecord.md)[]

Defined in: [packages/client/src/testing/createTestStorage.ts:29](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/testing/createTestStorage.ts#L29)

Pre-populate with read models

---

### session?

> `optional` **session**: [`SessionRecord`](../../../../interfaces/SessionRecord.md)

Defined in: [packages/client/src/testing/createTestStorage.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/testing/createTestStorage.ts#L21)

Pre-populate with a session
