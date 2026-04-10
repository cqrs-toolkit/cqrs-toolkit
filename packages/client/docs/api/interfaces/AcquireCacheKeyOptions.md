[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AcquireCacheKeyOptions

# Interface: AcquireCacheKeyOptions

Options for acquiring a cache key.

## Properties

### evictionPolicy?

> `optional` **evictionPolicy**: `"persistent"` \| `"ephemeral"`

Eviction policy for new keys (default: 'persistent')

---

### hold?

> `optional` **hold**: `boolean`

Whether to place a hold (prevents eviction)

---

### ttl?

> `optional` **ttl**: `number`

TTL in milliseconds (overrides default)

---

### windowId?

> `optional` **windowId**: `string`

**`Internal`**

Window ID for hold tracking. Injected by the facade/proxy.
