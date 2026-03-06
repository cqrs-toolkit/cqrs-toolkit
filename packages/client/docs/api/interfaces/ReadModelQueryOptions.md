[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelQueryOptions

# Interface: ReadModelQueryOptions

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:40](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/read-model-store/ReadModelStore.ts#L40)

Query options for listing read models.

## Extends

- [`QueryOptions`](QueryOptions.md)

## Extended by

- [`QueryManagerQueryOptions`](QueryManagerQueryOptions.md)

## Properties

### cacheKey?

> `optional` **cacheKey**: `string`

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:42](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/read-model-store/ReadModelStore.ts#L42)

Filter by cache key

---

### limit?

> `optional` **limit**: `number`

Defined in: [packages/client/src/storage/IStorage.ts:92](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L92)

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`limit`](QueryOptions.md#limit)

---

### localChangesOnly?

> `optional` **localChangesOnly**: `boolean`

Defined in: [packages/client/src/core/read-model-store/ReadModelStore.ts:44](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/read-model-store/ReadModelStore.ts#L44)

Only include models with local changes

---

### offset?

> `optional` **offset**: `number`

Defined in: [packages/client/src/storage/IStorage.ts:93](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L93)

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`offset`](QueryOptions.md#offset)

---

### orderBy?

> `optional` **orderBy**: `string`

Defined in: [packages/client/src/storage/IStorage.ts:94](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L94)

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`orderBy`](QueryOptions.md#orderby)

---

### orderDirection?

> `optional` **orderDirection**: `"asc"` \| `"desc"`

Defined in: [packages/client/src/storage/IStorage.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/IStorage.ts#L95)

#### Inherited from

[`QueryOptions`](QueryOptions.md).[`orderDirection`](QueryOptions.md#orderdirection)
