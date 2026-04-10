[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CacheKeyRecord

# Interface: CacheKeyRecord

Cache key record — persisted metadata for a cache key identity.
Stores the full identifying tuple so the identity can be rehydrated on reload.

## Properties

### createdAt

> **createdAt**: `number`

Creation timestamp

---

### estimatedSizeBytes

> **estimatedSizeBytes**: `number` \| `null`

Estimated size in bytes for quota-aware eviction prioritization

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

### frozenAt

> **frozenAt**: `number` \| `null`

Timestamp when the key was frozen (null if not frozen)

---

### holdCount

> **holdCount**: `number`

Hold count (prevents eviction when > 0)

---

### inheritedFrozen

> **inheritedFrozen**: `boolean`

Whether the cache key inherits frozen state from an ancestor

---

### key

> **key**: `string`

Cache key identifier (UUID v5 derived)

---

### kind

> **kind**: `"entity"` \| `"scope"`

Cache key kind

---

### lastAccessedAt

> **lastAccessedAt**: `number`

Last access timestamp

---

### linkId

> **linkId**: `string` \| `null`

Entity: Link.id (null for scope keys)

---

### linkService

> **linkService**: `string` \| `null`

Entity: ServiceLink.service (null for plain Link or scope keys)

---

### linkType

> **linkType**: `string` \| `null`

Entity: Link.type (null for scope keys)

---

### parentKey

> **parentKey**: `string` \| `null`

Parent cache key for hierarchical eviction (null if top-level)

---

### pendingIdMappings

> **pendingIdMappings**: `string` \| `null`

JSON-serialized array of pending ID mappings awaiting command resolution.
Each entry: `{ commandId: string; clientId: string; paramKey?: string }`.
Null when no IDs are pending (fully resolved or never had pending IDs).

---

### scopeParams

> **scopeParams**: `string` \| `null`

Scope: JSON-serialized scope params (null for entity keys or parameterless scopes)

---

### scopeType

> **scopeType**: `string` \| `null`

Scope: scope type identifier (null for entity keys)

---

### service

> **service**: `string` \| `null`

Scope: optional service context (null for entity keys)
