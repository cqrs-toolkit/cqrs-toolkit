[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModel

# Interface: ReadModel\<T\>

Read model with metadata.

## Type Parameters

### T

`T` = `unknown`

## Properties

### collection

> **collection**: `string`

Collection name

---

### data

> **data**: `T`

Effective data (server + local changes)

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Whether there are uncommitted local changes

---

### id

> **id**: `string`

Entity ID

---

### serverData?

> `optional` **serverData**: `T`

Server baseline data (undefined if only local)

---

### updatedAt

> **updatedAt**: `number`

Last update timestamp
