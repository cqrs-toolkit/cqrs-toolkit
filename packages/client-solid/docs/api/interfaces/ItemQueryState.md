[**@cqrs-toolkit/client-solid**](../README.md)

---

[@cqrs-toolkit/client-solid](../globals.md) / ItemQueryState

# Interface: ItemQueryState\<T\>

Reactive state returned by `createItemQuery`.

## Type Parameters

### T

`T` _extends_ [`Identifiable`](Identifiable.md)

## Properties

### data

> `readonly` **data**: `T` \| `undefined`

---

### error

> `readonly` **error**: `unknown`

---

### hasLocalChanges

> `readonly` **hasLocalChanges**: `boolean`

---

### loading

> `readonly` **loading**: `boolean`

---

### reconciledId

> `readonly` **reconciledId**: [`ReconciledId`](ReconciledId.md) \| `undefined`

Set when the item query detects that the tracked ID was reconciled
(client temp ID replaced by server ID). The query transparently follows
the new ID — consumers holding the old ID externally can react to update
their references.
