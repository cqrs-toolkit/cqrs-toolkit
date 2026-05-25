[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SortTerm

# Interface: SortTerm

One sort term in a [Sort](../type-aliases/Sort.md) spec — column name plus direction.

`column` accepts any library-owned column on the read-model table
(`id`, `updated_at`) or any custom column declared on the collection's
[ManagedCollectionDef](ManagedCollectionDef.md). SQLite resolves declared custom columns
as VIRTUAL generated columns; the in-memory backend falls back to the
top-level effective-data key with the same name when no path resolver
is wired (sufficient for shallow paths like `$.<field>`).

## Properties

### column

> **column**: `string`

---

### direction

> **direction**: `"asc"` \| `"desc"`
