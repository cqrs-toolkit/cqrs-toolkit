[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClientSyncManager

# Interface: CqrsClientSyncManager\<TLink\>

Restricted view of SyncManager exposed to consumers.
Start/stop are managed internally by the client lifecycle.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### connectivity

> `readonly` **connectivity**: [`IConnectivity`](IConnectivity.md)

Connectivity manager for network status observation.

## Methods

### getAllStatus()

> **getAllStatus**(): `Promise`\<[`CollectionSyncStatus`](CollectionSyncStatus.md)[]\>

Get sync status for all collections.

#### Returns

`Promise`\<[`CollectionSyncStatus`](CollectionSyncStatus.md)[]\>

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`, `cacheKey`): `Promise`\<[`CollectionSyncStatus`](CollectionSyncStatus.md) \| `undefined`\>

Get sync status for a specific (collection, cacheKey) pair.

#### Parameters

##### collection

`string`

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Returns

`Promise`\<[`CollectionSyncStatus`](CollectionSyncStatus.md) \| `undefined`\>

---

### getSeedStatus()

> **getSeedStatus**(`cacheKey`): `Promise`\<`"seeded"` \| `"seeding"` \| `"unseeded"`\>

Get the aggregate seed status for a cache key identity.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Returns

`Promise`\<`"seeded"` \| `"seeding"` \| `"unseeded"`\>

---

### seed()

> **seed**(`cacheKey`): `Promise`\<`void`\>

Seed all collections whose keyTypes match the given cache key identity.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Returns

`Promise`\<`void`\>

---

### setAuthenticated()

> **setAuthenticated**(`params`): `Promise`\<\{ `resumed`: `boolean`; \}\>

Signal that the user has been authenticated.

#### Parameters

##### params

###### userId

`string`

#### Returns

`Promise`\<\{ `resumed`: `boolean`; \}\>

---

### setUnauthenticated()

> **setUnauthenticated**(): `Promise`\<`void`\>

Signal that the user has logged out.

#### Returns

`Promise`\<`void`\>
