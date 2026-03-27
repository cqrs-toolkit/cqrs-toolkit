[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / ListQueryState

# Interface: ListQueryState\<T\>

Reactive state returned by `createListQuery`.

## Type Parameters

### T

`T` _extends_ [`Identifiable`](Identifiable.md)

## Properties

### hasLocalChanges

> `readonly` **hasLocalChanges**: `boolean`

---

### items

> `readonly` **items**: `T`[]

Current items (may be stale during `sync-failed`, empty during `seed-failed`)

---

### loading

> `readonly` **loading**: `boolean`

Convenience: `true` when `state.status` is `'loading'` or `'seeding'`

---

### reconciled

> `readonly` **reconciled**: [`ReconciledId`](ReconciledId.md)[]

Recent ID reconciliations for this collection.
Contains entries where a client-generated temp ID was replaced by a server ID.
Consumers holding entity IDs in signals can react to maintain stable references:

```ts
createEffect(() => {
  for (const { clientId, serverId } of query.reconciled) {
    if (selectedId() === clientId) setSelectedId(serverId)
  }
})
```

---

### state

> `readonly` **state**: `ListQueryStatus`

Lifecycle state with status-specific data

---

### total

> `readonly` **total**: `number`
