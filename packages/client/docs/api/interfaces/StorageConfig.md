[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / StorageConfig

# Interface: StorageConfig

Storage configuration.

## Properties

### dbName?

> `optional` **dbName**: `string`

Database name/path

---

### migrations

> **migrations**: \[[`SchemaMigration`](SchemaMigration.md), `...SchemaMigration[]`\]

Schema migrations — required, non-empty

---

### vfs?

> `optional` **vfs**: [`SqliteVfsType`](../type-aliases/SqliteVfsType.md)

VFS type (auto-selected based on mode if not specified)
