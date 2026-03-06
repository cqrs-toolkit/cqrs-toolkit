[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / QueryManagerQueryOptions

# Interface: QueryManagerQueryOptions

Defined in: [packages/client/src/core/query-manager/types.ts:11](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/query-manager/types.ts#L11)

Query options.

## Extends

- [`ReadModelQueryOptions`](ReadModelQueryOptions.md)

## Properties

### cacheKey?

> `optional` **cacheKey**: `string`

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:42](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L42)

Filter by cache key

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`cacheKey`](ReadModelQueryOptions.md#cachekey)

---

### hold?

> `optional` **hold**: `boolean`

Defined in: [packages/client/src/core/query-manager/types.ts:13](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/query-manager/types.ts#L13)

Place a hold on the cache key while query is active

---

### limit?

> `optional` **limit**: `number`

Defined in: [packages/client/src/storage/IStorage.ts:92](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/storage/IStorage.ts#L92)

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`limit`](ReadModelQueryOptions.md#limit)

---

### localChangesOnly?

> `optional` **localChangesOnly**: `boolean`

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:44](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/read-model-store/ReadModelStore.ts#L44)

Only include models with local changes

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`localChangesOnly`](ReadModelQueryOptions.md#localchangesonly)

---

### offset?

> `optional` **offset**: `number`

Defined in: [packages/client/src/storage/IStorage.ts:93](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/storage/IStorage.ts#L93)

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`offset`](ReadModelQueryOptions.md#offset)

---

### orderBy?

> `optional` **orderBy**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:94](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/storage/IStorage.ts#L94)

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`orderBy`](ReadModelQueryOptions.md#orderby)

---

### orderDirection?

> `optional` **orderDirection**: `"asc"` \| `"desc"`

Defined in: [packages/client/src/storage/IStorage.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/storage/IStorage.ts#L95)

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`orderDirection`](ReadModelQueryOptions.md#orderdirection)

---

### scope?

> `optional` **scope**: `string`

Defined in: [packages/client/src/core/query-manager/types.ts:15](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/query-manager/types.ts#L15)

Custom scope for the cache key
