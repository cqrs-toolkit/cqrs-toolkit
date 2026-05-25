[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ViewRegistration

# Interface: ViewRegistration\<TLink, TParams, TRow, T\>

Registration entry for a cross-collection view.

Two type parameters distinguish the SQL row shape (`TRow`) from the public
row shape (`T`). When the two coincide (consumer's SQL projects the final
shape directly), `T = TRow` collapses the type-system surface to one
parameter. When they differ — the common case for joined embeds where
SQL projects JSON strings and JS reshapes them into objects — the
consumer declares both.

Shape parity between `memory`'s output and the post-`transform` SQL output
is the consumer's responsibility; the library validates neither.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TParams

`TParams`

### TRow

`TRow`

### T

`T` = `TRow`

## Properties

### cacheKeys()

> **cacheKeys**: (`params`) => readonly [`CacheKeyTemplate`](../type-aliases/CacheKeyTemplate.md)\<`TLink`\>[]

Returns the cache-key templates the view reads from. The library resolves
each template to its [CacheKeyIdentity](../type-aliases/CacheKeyIdentity.md) for inclusion in the result.

`createViewQuery` (in `@cqrs-toolkit/client-solid`) holds the resolved
identities for the subscription's lifetime — pages don't redeclare or
hand-hold them. Standalone `getView` is hold-agnostic; callers that need
the underlying data to outlive the read manage holds via the cache
manager directly.

#### Parameters

##### params

`TParams`

#### Returns

readonly [`CacheKeyTemplate`](../type-aliases/CacheKeyTemplate.md)\<`TLink`\>[]

---

### joinSources

> **joinSources**: readonly `object`[]

Join-target collections. [IQueryManager.watchView](IQueryManager.md#watchview) tracks two id
sets per join for its row-level gates; in `getView` (pull) the
joinSources are advisory and aren't enforced.

`referencedIdPath` (required) is the id of the foreign target as it
appears on the projected row _after_ the join — non-empty only when the
target was loaded. Gates on updates / deletes to currently-loaded join
targets. Applies to every join shape, including ones where no specific
target id is known up front (e.g. "latest note in notebook" — the path
resolves to the embedded latest note's id when present).

`referencingIdPath` (optional) is the foreign-key-style id the primary
row carries to indicate which target it joins to, always present on the
projected row when the join is applicable (regardless of whether the
target was loaded). Gates on arrivals (`created` / `updated`) of
currently-missing join targets — closes the cold-start case. Only
applicable to key-based joins where the primary itself carries the id;
predicate-based joins (latest-note-in-notebook) leave this undeclared.

The projection must preserve the source field on the result row when
declaring `referencingIdPath` (e.g., spread the primary row before
adding `_embedded`).

---

### memory()

> **memory**: (`api`, `params`) => `T`[]

In-memory implementation. Sync; the library does not await per-row work.
Called in online-only mode against an `InMemoryStorage`-backed
[ViewLocalApi](ViewLocalApi.md).

#### Parameters

##### api

[`ViewLocalApi`](ViewLocalApi.md)

##### params

`TParams`

#### Returns

`T`[]

---

### memoryCount()?

> `optional` **memoryCount**: (`api`, `params`) => `number`

Optional total-count callback for the memory path. Runs independently of
`memory` so it can use a tighter iteration (skip embed building, skip
row construction) when the consumer only needs the count. Library
surfaces the return value as [PagedViewResult.total](PagedViewResult.md#total).

Independent of pagination kind — works whether `memory` is offset-sliced,
cursor-aware, or returns the full set.

#### Parameters

##### api

[`ViewLocalApi`](ViewLocalApi.md)

##### params

`TParams`

#### Returns

`number`

---

### name

> **name**: `string`

Unique view identifier.

---

### primarySource

> **primarySource**: `string`

Primary source collection — drives pagination in [IQueryManager.watchView](IQueryManager.md#watchview)'s
page-shift gate. Creates / deletes here may shift page composition.

---

### sql

> **sql**: `object`

SQL implementation. `query` returns the raw SQL string and positional
bindings; the library executes it verbatim against the active SQLite
backend. `transform` (optional) reshapes each result row from the raw
SQL projection (`TRow`) to the public row (`T`).

When `transform` is absent, `T == TRow` and the library returns SQL
rows as-is.

`count` (optional) supplies a separate query for the total row count.
The library executes it in parallel with `query` and surfaces the first
column of the first row as [PagedViewResult.total](PagedViewResult.md#total). Typical shape:
`SELECT COUNT(*) FROM rm_<table> WHERE ...`. Independent of `query`'s
pagination clause — works for offset, cursor, or no pagination.

#### count()?

> `optional` **count**: (`params`) => `object`

##### Parameters

###### params

`TParams`

##### Returns

`object`

###### bindings

> **bindings**: readonly `unknown`[]

###### sql

> **sql**: `string`

#### query()

> **query**: (`params`, `page`) => `object`

##### Parameters

###### params

`TParams`

###### page

[`PageRange`](../type-aliases/PageRange.md) | `undefined`

##### Returns

`object`

###### bindings

> **bindings**: readonly `unknown`[]

###### sql

> **sql**: `string`

#### transform()?

> `optional` **transform**: (`row`) => `T`

##### Parameters

###### row

`TRow`

##### Returns

`T`
