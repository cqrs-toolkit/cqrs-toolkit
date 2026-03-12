[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SQLiteStorageConfig

# Interface: SQLiteStorageConfig

SQLite storage configuration.

## Properties

### db

> **db**: [`ISqliteDb`](ISqliteDb.md)

Injected async SQLite database handle

---

### migrations

> **migrations**: \[[`SchemaMigration`](SchemaMigration.md), `...SchemaMigration[]`\]

Schema migrations — validated at construction time
