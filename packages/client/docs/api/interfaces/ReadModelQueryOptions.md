[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ReadModelQueryOptions

# Interface: ReadModelQueryOptions

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:40

Query options for listing read models.

## Extends

- [`QueryOptions`](QueryOptions.md)

## Extended by

- [`QueryManagerQueryOptions`](QueryManagerQueryOptions.md)

## Properties

### cacheKey?

> `optional` **cacheKey**: `string`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:42

Filter by cache key

***

### limit?

> `optional` **limit**: `number`

Defined in: packages/client/src/storage/IStorage.ts:90

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`limit`](QueryOptions.md#limit)

***

### localChangesOnly?

> `optional` **localChangesOnly**: `boolean`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:44

Only include models with local changes

***

### offset?

> `optional` **offset**: `number`

Defined in: packages/client/src/storage/IStorage.ts:91

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`offset`](QueryOptions.md#offset)

***

### orderBy?

> `optional` **orderBy**: `string`

Defined in: packages/client/src/storage/IStorage.ts:92

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`orderBy`](QueryOptions.md#orderby)

***

### orderDirection?

> `optional` **orderDirection**: `"asc"` \| `"desc"`

Defined in: packages/client/src/storage/IStorage.ts:93

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`orderDirection`](QueryOptions.md#orderdirection)
