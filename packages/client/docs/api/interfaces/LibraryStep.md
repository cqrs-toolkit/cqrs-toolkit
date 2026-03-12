[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryStep

# Interface: LibraryStep

A library-owned schema step.

Library steps create infrastructure tables (session, commands, cache_keys, etc.).
They are placed by the consumer inside their `SchemaMigration` sequence.

Future: `collectionHook: (tableName: string) => string[]` will be added for
v2+ library upgrades that need to ALTER pre-existing managed tables.
The runner will query `sqlite_master` to introspect which `rm_*` tables
actually exist before applying the hook — tables from earlier migrations
may have been dropped by the user.

## Properties

### id

> **id**: `string`

Identifies this step (e.g., 'init')

---

### sql

> **sql**: `string`[]

Infrastructure DDL statements

---

### type

> **type**: `"library"`

---

### version

> **version**: `number`

Ordering version within library steps (1, 2, 3...)
