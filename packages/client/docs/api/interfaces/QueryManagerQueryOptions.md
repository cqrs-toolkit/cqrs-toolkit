[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / QueryManagerQueryOptions

# Interface: QueryManagerQueryOptions

Defined in: packages/client/src/core/query-manager/QueryManager.ts:26

Query options.

## Extends

- [`ReadModelQueryOptions`](ReadModelQueryOptions.md)

## Properties

### cacheKey?

> `optional` **cacheKey**: `string`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:42

Filter by cache key

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`cacheKey`](ReadModelQueryOptions.md#cachekey)

***

### hold?

> `optional` **hold**: `boolean`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:28

Place a hold on the cache key while query is active

***

### limit?

> `optional` **limit**: `number`

Defined in: packages/client/src/storage/IStorage.ts:90

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`limit`](ReadModelQueryOptions.md#limit)

***

### localChangesOnly?

> `optional` **localChangesOnly**: `boolean`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:44

Only include models with local changes

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`localChangesOnly`](ReadModelQueryOptions.md#localchangesonly)

***

### offset?

> `optional` **offset**: `number`

Defined in: packages/client/src/storage/IStorage.ts:91

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`offset`](ReadModelQueryOptions.md#offset)

***

### orderBy?

> `optional` **orderBy**: `string`

Defined in: packages/client/src/storage/IStorage.ts:92

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`orderBy`](ReadModelQueryOptions.md#orderby)

***

### orderDirection?

> `optional` **orderDirection**: `"asc"` \| `"desc"`

Defined in: packages/client/src/storage/IStorage.ts:93

#### Inherited from

[`ReadModelQueryOptions`](ReadModelQueryOptions.md).[`orderDirection`](ReadModelQueryOptions.md#orderdirection)

***

### scope?

> `optional` **scope**: `string`

Defined in: packages/client/src/core/query-manager/QueryManager.ts:30

Custom scope for the cache key
