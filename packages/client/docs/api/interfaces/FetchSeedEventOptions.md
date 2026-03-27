[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / FetchSeedEventOptions

# Interface: FetchSeedEventOptions\<TLink\>

Options for [Collection.fetchSeedEvents](Collection.md#fetchseedevents).

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cacheKey

> `readonly` **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity being seeded — extract scope params for query filtering

---

### ctx

> `readonly` **ctx**: [`FetchContext`](FetchContext.md)

---

### cursor

> `readonly` **cursor**: `string` \| `null`

---

### limit

> `readonly` **limit**: `number`
