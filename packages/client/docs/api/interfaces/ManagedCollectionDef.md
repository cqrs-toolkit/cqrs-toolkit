[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ManagedCollectionDef

# Interface: ManagedCollectionDef

A managed read model collection.

The library owns the table schema — fresh-create DDL via
`generateCollectionDDL(def)` produces `rm_{name}` with library-owned
bookkeeping columns plus any declared CustomColumns and
CustomIndexes.

## Properties

### columns?

> `optional` **columns**: `CustomColumn`[]

Custom VIRTUAL generated columns extracted from `_effective_data`.
Used by SQL views for filter / sort / join expressions. Ignored by
the in-memory backend.

---

### indexes?

> `optional` **indexes**: `CustomIndex`[]

Indexes — single-column or composite, optional UNIQUE, optional partial
(`WHERE` predicate). Reference declared columns or library-owned
columns by name.

---

### name

> **name**: `string`

---

### type

> **type**: `"managed"`
