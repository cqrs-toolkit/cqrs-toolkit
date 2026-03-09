[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheKeyRecord

# Interface: CacheKeyRecord

Cache key record.

## Properties

### createdAt

> **createdAt**: `number`

Creation timestamp

---

### evictionPolicy

> **evictionPolicy**: `"persistent"` \| `"ephemeral"`

Eviction policy — persistent keys can be frozen and survive restarts; ephemeral keys cannot

---

### expiresAt

> **expiresAt**: `number` \| `null`

TTL expiration timestamp (null = no expiration)

---

### frozen

> **frozen**: `boolean`

Whether the cache key is frozen

---

### holdCount

> **holdCount**: `number`

Hold count (prevents eviction when > 0)

---

### key

> **key**: `string`

Cache key identifier (UUID v5 derived)

---

### lastAccessedAt

> **lastAccessedAt**: `number`

Last access timestamp
