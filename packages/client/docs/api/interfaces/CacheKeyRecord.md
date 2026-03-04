[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheKeyRecord

# Interface: CacheKeyRecord

Defined in: packages/client/src/storage/IStorage.ts:25

Cache key record.

## Properties

### createdAt

> **createdAt**: `number`

Defined in: packages/client/src/storage/IStorage.ts:37

Creation timestamp

---

### evictionPolicy

> **evictionPolicy**: `"persistent"` \| `"ephemeral"`

Defined in: packages/client/src/storage/IStorage.ts:39

Eviction policy — persistent keys can be frozen and survive restarts; ephemeral keys cannot

---

### expiresAt

> **expiresAt**: `number` \| `null`

Defined in: packages/client/src/storage/IStorage.ts:35

TTL expiration timestamp (null = no expiration)

---

### frozen

> **frozen**: `boolean`

Defined in: packages/client/src/storage/IStorage.ts:33

Whether the cache key is frozen

---

### holdCount

> **holdCount**: `number`

Defined in: packages/client/src/storage/IStorage.ts:31

Hold count (prevents eviction when > 0)

---

### key

> **key**: `string`

Defined in: packages/client/src/storage/IStorage.ts:27

Cache key identifier (UUID v5 derived)

---

### lastAccessedAt

> **lastAccessedAt**: `number`

Defined in: packages/client/src/storage/IStorage.ts:29

Last access timestamp
