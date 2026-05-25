[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / ViewQueryState

# Interface: ViewQueryState\<T\>

Reactive state returned by `createViewQuery`.

## Type Parameters

### T

`T` _extends_ [`Identifiable`](Identifiable.md)

## Properties

### items

> `readonly` **items**: `T`[]

Current rows from the view's last emission.

---

### loading

> `readonly` **loading**: `boolean`

Convenience: `true` when `state.status` is `'loading'`.

---

### state

> `readonly` **state**: [`ViewQueryStatus`](../type-aliases/ViewQueryStatus.md)

Lifecycle state with status-specific data.

---

### total

> `readonly` **total**: `number` \| `undefined`

Total row count for the view's query, independent of pagination.
Populated when the view registration supplies a count callback
(`memoryCount` on the memory path or `sql.count` on the SQL path).
`undefined` when no count callback is configured.
