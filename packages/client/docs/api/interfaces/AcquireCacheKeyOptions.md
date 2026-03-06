[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / AcquireCacheKeyOptions

# Interface: AcquireCacheKeyOptions

Defined in: [packages/client/src/core/cache-manager/types.ts:10](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/types.ts#L10)

Options for acquiring a cache key.

## Properties

### evictionPolicy?

> `optional` **evictionPolicy**: `"persistent"` \| `"ephemeral"`

Defined in: [packages/client/src/core/cache-manager/types.ts:18](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/types.ts#L18)

Eviction policy for new keys (default: 'persistent')

---

### hold?

> `optional` **hold**: `boolean`

Defined in: [packages/client/src/core/cache-manager/types.ts:12](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/types.ts#L12)

Whether to place a hold (prevents eviction)

---

### scope?

> `optional` **scope**: `string`

Defined in: [packages/client/src/core/cache-manager/types.ts:16](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/types.ts#L16)

Scope for the cache key

---

### ttl?

> `optional` **ttl**: `number`

Defined in: [packages/client/src/core/cache-manager/types.ts:14](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/cache-manager/types.ts#L14)

TTL in milliseconds (overrides default)
