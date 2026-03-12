[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ManagedCollectionDef

# Interface: ManagedCollectionDef

A managed read model collection.

The library owns the table schema — `generateCollectionDDL(name)` creates
`rm_{name}` with the standard columns.

## Properties

### name

> **name**: `string`

---

### type

> **type**: `"managed"`
