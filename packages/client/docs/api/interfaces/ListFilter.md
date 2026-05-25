[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ListFilter

# Interface: ListFilter

Filter applied to a [IQueryManager.list](IQueryManager.md#list) / [IQueryManager.watchList](IQueryManager.md#watchlist)
call. Ships both backends.

- `memory` runs inline against each row of the cache-key-scoped scan —
  one loop, no second pass. The row arg is the parsed effective-data
  shape; cast to your row type at the call site.
- `sql` returns the inner predicate **only** — no `WHERE`, no leading
  `AND`. The library wraps the fragment as:

      WHERE <library-cache-key-clause> AND (<your-fragment>)

  so the cache-key scope cannot be broken by author choice. Author
  OR-groups inside your fragment freely; the outer parens are guaranteed.
  The library invokes the callback exactly once per `list` (or per
  `watchList` re-fetch) and never inspects it again, so closure
  variables are captured at call time.

## Properties

### memory()

> **memory**: (`row`, `params`) => `boolean`

#### Parameters

##### row

`unknown`

##### params

`unknown`

#### Returns

`boolean`

---

### params

> **params**: `unknown`

---

### sql()

> **sql**: (`params`) => `object`

#### Parameters

##### params

`unknown`

#### Returns

`object`

##### bindings

> **bindings**: readonly `unknown`[]

##### sql

> **sql**: `string`
