[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / ListQueryState

# Interface: ListQueryState\<T\>

Reactive state returned by `createListQuery`.

## Type Parameters

### T

`T` _extends_ [`Identifiable`](Identifiable.md)

## Properties

### error

> `readonly` **error**: `unknown`

---

### hasLocalChanges

> `readonly` **hasLocalChanges**: `boolean`

---

### items

> `readonly` **items**: readonly `T`[]

---

### loading

> `readonly` **loading**: `boolean`

---

### reconciled

> `readonly` **reconciled**: readonly [`ReconciledId`](ReconciledId.md)[]

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

### total

> `readonly` **total**: `number`
